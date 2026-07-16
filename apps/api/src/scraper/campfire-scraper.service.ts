import { BadRequestException, Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { normalizeEndingSoonDays } from '../projects/domain/project-import-policy';
import { ProjectSearchDiagnostics } from '../projects/domain/project-source-provider';
import { RawProjectPageSnapshot } from '../projects/infrastructure/parsers/parser.types';
import { parseCampfireDetail } from '../projects/infrastructure/parsers/campfire/campfire-detail.parser';
import { parseCampfireListing } from '../projects/infrastructure/parsers/campfire/campfire-listing.parser';
import { mapCampfireListingItem } from '../projects/infrastructure/parsers/campfire/campfire-listing.mapper';
import { parseCampfireProfile } from '../projects/infrastructure/parsers/campfire/campfire-profile.parser';
import { mapCampfireProfileProjectCount, matchesCampfireProfileProjectRange } from '../projects/infrastructure/parsers/campfire/campfire-profile.mapper';
import { CampfireDetail } from '../projects/infrastructure/parsers/campfire/campfire.types';

const CAMPFIRE_ORIGIN = 'https://camp-fire.jp';
const DEFAULT_SEARCH_RESULT_LIMIT = 10;
const SEARCH_RESULT_LIMITS = [10, 50, 100, 150, 200];
const PROFILE_LOOKUP_CONCURRENCY = clampNumber(Number(process.env.CAMPFIRE_PROFILE_LOOKUP_CONCURRENCY || 8), 1, 12);
const SEARCH_CACHE_TTL_MS = clampNumber(Number(process.env.CAMPFIRE_SEARCH_CACHE_TTL_MS || 5 * 60 * 1000), 0, 30 * 60 * 1000);
const CAMPFIRE_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const searchCache = new Map<string, { expiresAt: number; items: CampfireSearchResult[]; diagnostics: ProjectSearchDiagnostics }>();

export type ScrapedCampfireProject = {
  projectUrl: string;
  projectId: string;
  projectTitle: string;
  executorName: string;
  brandName: string;
  supportAmount: string;
  supporters: string;
  achievementRate: string;
  daysLeft: string;
  mainDescription: string;
  category: string;
  features: string[];
  profileUrl: string;
  profileProjectCount: number | null;
  websiteUrl: string;
  inquiryUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  xUrl: string;
  externalUrls: string[];
};

export type CampfireSearchInput = {
  keyword?: string;
  category?: string;
  amountMin?: number;
  amountMax?: number;
  supporterMin?: number;
  supporterMax?: number;
  profileProjectMin?: number;
  profileProjectMax?: number;
  limit?: number;
  status?: string;
  endingSoonDays?: number;
  excludeUrls?: string[];
};

export type CampfireSearchResult = {
  title: string;
  url: string;
  amount: number;
  supporterCount: number;
  category: string;
  daysLeft: number | null;
  isActive: boolean;
  profileProjectCount: number | null;
  summary: string;
};

export type CampfireCategoryOption = {
  label: string;
  value: string;
};

const PRESET_CAMPFIRE_CATEGORIES: CampfireCategoryOption[] = [
  'プロダクト',
  'テクノロジー・ガジェット',
  'フード・飲食店',
  'ファッション',
  'ビューティー・ヘルスケア',
  'アート・写真',
  '音楽',
  '映画・映像',
  'ゲーム・サービス開発',
  'まちづくり・地域活性化',
  'ソーシャルグッド',
  'スポーツ',
  '出版・ジャーナリズム',
  '教育',
  'チャレンジ',
  'アニメ・漫画',
  'ビジネス・起業'
].map((label) => ({ label, value: `preset:${label}` }));

@Injectable()
export class CampfireScraperService {
  async categories(): Promise<{ items: CampfireCategoryOption[] }> {
    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({ userAgent: CAMPFIRE_USER_AGENT });
      const page = await context.newPage();
      await openPage(page, buildCampfireSearchUrl());
      const html = await page.content();
      return { items: mergeCategoryOptions(extractCategoryOptions(html)) };
    } catch {
      return { items: PRESET_CAMPFIRE_CATEGORIES };
    } finally {
      await browser.close();
    }
  }

  async search(input: CampfireSearchInput): Promise<{ items: CampfireSearchResult[]; total: number; diagnostics: ProjectSearchDiagnostics }> {
    const cacheKey = buildSearchCacheKey(input);
    const cached = readSearchCache(cacheKey);
    if (cached) {
      return { items: cached.items, total: cached.items.length, diagnostics: cached.diagnostics };
    }

    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({ userAgent: CAMPFIRE_USER_AGENT });
      const page = await context.newPage();
      await openPage(page, buildCampfireSearchUrl(input.keyword, input.category));
      const resultLimit = normalizeSearchLimit(input.limit);
      const excludedUrls = buildExcludedUrlSet(input.excludeUrls);
      const collection = hasProfileProjectFilter(input)
        ? await collectSearchResultsMatchingProfileRange(page, input, resultLimit, excludedUrls)
        : await collectSearchResults(page, resultLimit, excludedUrls, input);
      const sortedItems = sortSearchResults(collection.items, input).slice(0, resultLimit);
      writeSearchCache(cacheKey, sortedItems, collection.diagnostics);
      return { items: sortedItems, total: sortedItems.length, diagnostics: collection.diagnostics };
    } finally {
      await browser.close();
    }
  }

  async scrape(inputUrl: string): Promise<ScrapedCampfireProject> {
    const url = validateCampfireUrl(inputUrl);
    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({ userAgent: CAMPFIRE_USER_AGENT });
      const page = await context.newPage();
      await openPage(page, url);
      const html = await page.content();
      const parsed = parseCampfireDetail(buildSnapshot('detail', url, html));
      const project = toScrapedCampfireProject(parsed.value);
      assertProjectIsFundraising(project, parsed.value.publicStatus);
      project.profileProjectCount = (await fetchProfileProjectCount(page, project.profileUrl, project.profileProjectCount)) ?? project.profileProjectCount;

      if (!project.projectTitle) {
        throw new BadRequestException('CAMPFIREプロジェクト名を取得できませんでした。');
      }

      return project;
    } finally {
      await browser.close();
    }
  }
}

function buildCampfireSearchUrl(keyword?: string, category?: string) {
  const url = normalizeCampfireCategoryUrl(category) || new URL('/projects/search', CAMPFIRE_ORIGIN);
  const searchWords = [keyword?.trim(), normalizePresetCategory(category)].filter(Boolean).join(' ');
  if (searchWords) {
    url.searchParams.set('word', searchWords);
  }
  return url.toString();
}

function extractCategoryOptions(html: string) {
  const $ = cheerio.load(html);
  const fromOptions = $('select option')
    .toArray()
    .map((element) => toCategoryOption(clean($(element).text()), $(element).attr('value') || ''))
    .filter((item): item is CampfireCategoryOption => Boolean(item));
  const fromLinks = $('a[href*="category"], a[href*="categories"]')
    .toArray()
    .map((element) => toCategoryOption(clean($(element).text()), $(element).attr('href') || ''))
    .filter((item): item is CampfireCategoryOption => Boolean(item));

  return uniqueBy([...fromOptions, ...fromLinks], (item) => normalizeUrlForUnique(item.value)).slice(0, 50);
}

function mergeCategoryOptions(scraped: CampfireCategoryOption[]) {
  return uniqueBy([...scraped, ...PRESET_CAMPFIRE_CATEGORIES], (item) => normalizeText(item.label)).slice(0, 70);
}

function toCategoryOption(label: string, value: string): CampfireCategoryOption | null {
  if (!isCategoryLabel(label)) return null;
  const url = normalizeCampfireCategoryUrl(value);
  if (!url) return null;
  return { label, value: url.toString() };
}

function isCategoryLabel(value: string) {
  if (!value || value.length > 30) return false;
  if (/すべて|全て|カテゴリ|カテゴリー|探す|検索|ログイン|新規登録/.test(value)) return false;
  return /[ぁ-んァ-ン一-龥A-Za-z0-9]/.test(value);
}

function normalizeCampfireCategoryUrl(value?: string) {
  if (!value?.trim()) return null;
  let url: URL;
  try {
    url = new URL(value, CAMPFIRE_ORIGIN);
  } catch {
    return null;
  }

  if (!['camp-fire.jp', 'www.camp-fire.jp'].includes(url.hostname)) return null;
  if (!/categor/i.test(url.pathname + url.search)) return null;
  return url;
}

function normalizePresetCategory(value?: string) {
  if (!value?.startsWith('preset:')) return '';
  return value.replace(/^preset:/, '').trim();
}

function extractSearchResults(html: string): CampfireSearchResult[] {
  const parsed = parseCampfireListing(buildSnapshot('listing', buildCampfireSearchUrl(), html));
  return parsed.value.map(mapCampfireListingItem);
}

type SearchCollectionTracker = {
  sourceUrls: Set<string>;
  conditionMatchedUrls: Set<string>;
  excludedUrls: Set<string>;
};

function createSearchCollectionTracker(): SearchCollectionTracker {
  return { sourceUrls: new Set(), conditionMatchedUrls: new Set(), excludedUrls: new Set() };
}

function searchCollectionDiagnostics(tracker: SearchCollectionTracker, scanComplete: boolean): ProjectSearchDiagnostics {
  return {
    sourceCandidateCount: tracker.sourceUrls.size,
    conditionMatchedCount: tracker.conditionMatchedUrls.size,
    excludedCount: tracker.excludedUrls.size,
    scanComplete
  };
}

async function collectSearchResults(page: Page, limit: number, excludedUrls = new Set<string>(), input: CampfireSearchInput = {}) {
  let items: CampfireSearchResult[] = [];
  let unchangedCount = 0;
  let scanComplete = false;
  const tracker = createSearchCollectionTracker();

  for (let attempt = 0; attempt < 8 && items.length < limit; attempt += 1) {
    const beforeCount = items.length;
    items = mergeSearchResults(items, extractSearchResults(await page.content()), excludedUrls, input, tracker);

    if (items.length >= limit) break;

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
    await page.waitForTimeout(500);
    items = mergeSearchResults(items, extractSearchResults(await page.content()), excludedUrls, input, tracker);

    if (items.length >= limit) break;

    const clickedMore = await clickNextSearchResults(page);
    if (clickedMore) {
      await page.waitForTimeout(700);
      items = mergeSearchResults(items, extractSearchResults(await page.content()), excludedUrls, input, tracker);
    }

    unchangedCount = items.length === beforeCount ? unchangedCount + 1 : 0;
    if (!clickedMore && unchangedCount >= 2) {
      scanComplete = true;
      break;
    }
  }

  if (items.length < limit) scanComplete = true;
  return { items: items.slice(0, limit), diagnostics: searchCollectionDiagnostics(tracker, scanComplete) };
}

async function collectSearchResultsMatchingProfileRange(page: Page, input: CampfireSearchInput, limit: number, excludedUrls = new Set<string>()) {
  let items: CampfireSearchResult[] = [];
  let matched: CampfireSearchResult[] = [];
  let unchangedCount = 0;
  let scanComplete = false;
  const tracker = createSearchCollectionTracker();
  const checkedUrls = new Set<string>();
  const maxCandidates = Math.min(Math.max(limit * 10, 100), 300);
  for (let attempt = 0; attempt < 20 && matched.length < limit && items.length < maxCandidates; attempt += 1) {
    const beforeCount = items.length;
    items = mergeSearchResults(items, extractSearchResults(await page.content()), excludedUrls, input, tracker);
    matched = await collectProfileMatchesFromCandidates(page.context(), items, input, checkedUrls, matched, limit);

    if (matched.length >= limit || items.length >= maxCandidates) break;

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
    await page.waitForTimeout(350);
    items = mergeSearchResults(items, extractSearchResults(await page.content()), excludedUrls, input, tracker);
    matched = await collectProfileMatchesFromCandidates(page.context(), items, input, checkedUrls, matched, limit);

    if (matched.length >= limit || items.length >= maxCandidates) break;

    const clickedMore = await clickNextSearchResults(page);
    if (clickedMore) {
      await page.waitForTimeout(700);
      items = mergeSearchResults(items, extractSearchResults(await page.content()), excludedUrls, input, tracker);
      matched = await collectProfileMatchesFromCandidates(page.context(), items, input, checkedUrls, matched, limit);
    }

    unchangedCount = items.length === beforeCount ? unchangedCount + 1 : 0;
    if (!clickedMore && unchangedCount >= 2) {
      scanComplete = true;
      break;
    }
  }

  if (matched.length < limit) scanComplete = true;
  return {
    items: matched,
    diagnostics: {
      sourceCandidateCount: tracker.sourceUrls.size,
      conditionMatchedCount: matched.length,
      excludedCount: 0,
      scanComplete
    }
  };
}

async function collectProfileMatchesFromCandidates(
  context: BrowserContext,
  items: CampfireSearchResult[],
  input: CampfireSearchInput,
  checkedUrls: Set<string>,
  matched: CampfireSearchResult[],
  limit: number
) {
  const nextMatched = [...matched];
  const matchedUrls = new Set(nextMatched.map((item) => normalizeUrlForUnique(item.url)));

  const candidates: CampfireSearchResult[] = [];
  for (const item of items) {
    if (nextMatched.length >= limit) break;

    const key = normalizeUrlForUnique(item.url);
    if (checkedUrls.has(key) || matchedUrls.has(key)) continue;
    checkedUrls.add(key);
    candidates.push(item);
  }

  for (let start = 0; start < candidates.length && nextMatched.length < limit; start += PROFILE_LOOKUP_CONCURRENCY) {
    const batch = candidates.slice(start, start + PROFILE_LOOKUP_CONCURRENCY);
    const enrichedBatch = await Promise.all(
      batch.map((item) => item.profileProjectCount === null ? enrichWithProjectPageProfileCount(context, item) : Promise.resolve(item))
    );

    for (const enriched of enrichedBatch) {
      if (nextMatched.length >= limit) break;
      if (!matchesProfileProjectRange(enriched, input)) continue;
      nextMatched.push(enriched);
      matchedUrls.add(normalizeUrlForUnique(enriched.url));
    }
  }

  return nextMatched;
}

function buildExcludedUrlSet(urls?: string[]) {
  return new Set((urls || []).map((url) => normalizeUrlForUnique(url)).filter(Boolean));
}

function mergeSearchResults(
  current: CampfireSearchResult[],
  next: CampfireSearchResult[],
  excludedUrls: Set<string>,
  input: CampfireSearchInput = {},
  tracker?: SearchCollectionTracker
) {
  next.forEach((item) => {
    const key = normalizeUrlForUnique(item.url);
    tracker?.sourceUrls.add(key);
    if (!matchesSearchStatus(item, input)) return;
    tracker?.conditionMatchedUrls.add(key);
    if (excludedUrls.has(key)) tracker?.excludedUrls.add(key);
  });
  return uniqueBy(
    [
      ...current,
      ...next.filter((item) => !excludedUrls.has(normalizeUrlForUnique(item.url)) && matchesSearchStatus(item, input))
    ],
    (item) => normalizeUrlForUnique(item.url)
  );
}

export function matchesSearchStatus(item: CampfireSearchResult, input: CampfireSearchInput) {
  if (!input.status) return item.isActive;
  if (input.status === 'active') return item.isActive;
  if (input.status === 'endingSoon') return item.isActive && item.daysLeft !== null && item.daysLeft <= normalizeEndingSoonDays(input.endingSoonDays);
  return true;
}

export function sortSearchResults(items: CampfireSearchResult[], input: CampfireSearchInput) {
  if (input.status !== 'endingSoon') return items;
  const maxDays = normalizeEndingSoonDays(input.endingSoonDays);
  return [...items]
    .filter((item) => item.isActive && typeof item.daysLeft === 'number' && item.daysLeft <= maxDays)
    .sort((a, b) => Number(a.daysLeft) - Number(b.daysLeft));
}

async function enrichWithProjectPageProfileCount(context: BrowserContext, item: CampfireSearchResult) {
  const page = await context.newPage();
  try {
    await openPageFast(page, item.url);
    const detailHtml = await page.content();
    const detail = parseCampfireDetail(buildSnapshot('detail', item.url, detailHtml));
    if (!detail.value.profileUrl) return item;

    await openPageFast(page, detail.value.profileUrl);
    const profileHtml = await page.content();
    const profileText = (await page.locator('body').innerText({ timeout: 1200 })).replace(/\s+/g, ' ').trim();
    const profile = parseCampfireProfile(buildSnapshot('profile', detail.value.profileUrl, profileHtml, profileText));
    return { ...item, profileProjectCount: mapCampfireProfileProjectCount(profile.value.projectCount) };
  } catch {
    return item;
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function clickNextSearchResults(page: Page) {
  const candidates = [
    page.locator('button, a').filter({ hasText: /もっと見る|さらに見る|次へ|次のページ/ }).first(),
    page.locator('a[rel="next"], button[aria-label*="次"], a[aria-label*="次"]').first()
  ];

  for (const candidate of candidates) {
    try {
      if ((await candidate.count()) === 0) continue;
      await candidate.click({ timeout: 1500 });
      await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => undefined);
      return true;
    } catch {
      // CAMPFIREの検索UIは変更されることがあるため、押せない場合は次の候補を試す。
    }
  }

  return false;
}

function normalizeSearchLimit(limit?: number) {
  return SEARCH_RESULT_LIMITS.includes(Number(limit)) ? Number(limit) : DEFAULT_SEARCH_RESULT_LIMIT;
}

function buildSearchCacheKey(input: CampfireSearchInput) {
  return JSON.stringify({
    keyword: input.keyword || '',
    category: input.category || '',
    amountMin: input.amountMin ?? null,
    amountMax: input.amountMax ?? null,
    supporterMin: input.supporterMin ?? null,
    supporterMax: input.supporterMax ?? null,
    profileProjectMin: input.profileProjectMin ?? null,
    profileProjectMax: input.profileProjectMax ?? null,
    limit: normalizeSearchLimit(input.limit),
    status: input.status || '',
    endingSoonDays: input.status === 'endingSoon' ? normalizeEndingSoonDays(input.endingSoonDays) : null,
    excludeUrls: Array.from(buildExcludedUrlSet(input.excludeUrls)).sort()
  });
}

function readSearchCache(key: string) {
  if (!SEARCH_CACHE_TTL_MS) return null;
  const cached = searchCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    searchCache.delete(key);
    return null;
  }
  return {
    items: cached.items.map((item) => ({ ...item })),
    diagnostics: { ...cached.diagnostics }
  };
}

function writeSearchCache(key: string, items: CampfireSearchResult[], diagnostics: ProjectSearchDiagnostics) {
  if (!SEARCH_CACHE_TTL_MS) return;
  searchCache.set(key, {
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    items: items.map((item) => ({ ...item })),
    diagnostics: { ...diagnostics }
  });
  pruneSearchCache();
}

function pruneSearchCache() {
  if (searchCache.size <= 30) return;
  const now = Date.now();
  for (const [key, value] of searchCache.entries()) {
    if (value.expiresAt <= now || searchCache.size > 30) searchCache.delete(key);
  }
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function hasProfileProjectFilter(input: CampfireSearchInput) {
  return typeof input.profileProjectMin === 'number' || typeof input.profileProjectMax === 'number';
}

function matchesProfileProjectRange(item: CampfireSearchResult, input: CampfireSearchInput) {
  if (!hasProfileProjectFilter(input)) return true;
  return matchesCampfireProfileProjectRange(item.profileProjectCount, input.profileProjectMin, input.profileProjectMax);
}

async function fetchProfileProjectCount(
  page: Page,
  profileUrl: string,
  fallbackCount: number | null = null,
  strictProfileLookup = false
) {
  if (fallbackCount !== null) return fallbackCount;

  if (!profileUrl) return strictProfileLookup ? null : fallbackCount;

  try {
    await openPageFast(page, profileUrl);
    const profileHtml = await page.content();
    const profileText = (await page.locator('body').innerText({ timeout: 2500 })).replace(/\s+/g, ' ').trim();
    const profile = parseCampfireProfile(buildSnapshot('profile', profileUrl, profileHtml, profileText));
    return mapCampfireProfileProjectCount(profile.value.projectCount) ?? fallbackCount;
  } catch {
    return strictProfileLookup ? null : fallbackCount;
  }
}

function normalizeText(value: string | undefined) {
  return (value || '').toLowerCase().replace(/\s+/g, '');
}

async function openPage(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('load', { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(900);
}

async function openPageFast(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
  await page.waitForLoadState('load', { timeout: 2000 }).catch(() => undefined);
  await page.waitForTimeout(150);
}

function validateCampfireUrl(url: string) {
  if (!url) {
    throw new BadRequestException('CAMPFIRE URL is required.');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('URL format is invalid.');
  }

  if (!['camp-fire.jp', 'www.camp-fire.jp'].includes(parsed.hostname)) {
    throw new BadRequestException('CAMPFIRE URLを指定してください。');
  }

  if (!parsed.pathname.includes('/projects/')) {
    throw new BadRequestException('CAMPFIREプロジェクトページURLを指定してください。');
  }

  return parsed.toString();
}

function buildSnapshot(kind: RawProjectPageSnapshot['kind'], url: string, html: string, visibleText?: string): RawProjectPageSnapshot {
  return { source: 'campfire', kind, url, html, visibleText };
}

function toScrapedCampfireProject(detail: CampfireDetail): ScrapedCampfireProject {
  return {
    projectUrl: detail.projectUrl,
    projectId: detail.projectId,
    projectTitle: detail.projectTitle,
    executorName: detail.executorName,
    brandName: detail.brandName,
    supportAmount: detail.supportAmount,
    supporters: detail.supporters,
    achievementRate: detail.achievementRate,
    daysLeft: detail.daysLeft || '',
    mainDescription: detail.mainDescription,
    category: detail.category,
    features: detail.features,
    profileUrl: detail.profileUrl,
    profileProjectCount: null,
    websiteUrl: detail.websiteUrl,
    inquiryUrl: detail.inquiryUrl,
    instagramUrl: detail.instagramUrl,
    tiktokUrl: detail.tiktokUrl,
    xUrl: detail.xUrl,
    externalUrls: detail.externalUrls
  };
}

function assertProjectIsFundraising(project: ScrapedCampfireProject, publicStatus = '') {
  const isActive = !/(もうすぐ公開|近日公開|公開予定|COMING\s*SOON|終了したもの|終了しました|募集終了|受付終了|終了|SUCCESS|失敗)/i.test(publicStatus) && Boolean(project.daysLeft);
  if (isActive) return;
  throw new BadRequestException('このCAMPFIREプロジェクトは募集中ではないため取り込みません。終了済み・公開前の案件は営業対象から除外します。');
}

function normalizeUrlForUnique(value: string) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return value;
  }
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function clean(value: string | undefined | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function parseInteger(value: string) {
  const number = Number((value || '').replace(/[^0-9]/g, ''));
  return Number.isFinite(number) ? number : 0;
}
