import { BadRequestException, Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { chromium, type Page } from 'playwright';

const CAMPFIRE_ORIGIN = 'https://camp-fire.jp';
const DEFAULT_SEARCH_RESULT_LIMIT = 10;
const SEARCH_RESULT_LIMITS = [10, 50, 100];
const CAMPFIRE_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

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

  async search(input: CampfireSearchInput): Promise<{ items: CampfireSearchResult[]; total: number }> {
    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({ userAgent: CAMPFIRE_USER_AGENT });
      const page = await context.newPage();
      await openPage(page, buildCampfireSearchUrl(input.keyword, input.category));
      const resultLimit = normalizeSearchLimit(input.limit);
      const items = hasProfileProjectFilter(input)
        ? await collectSearchResultsMatchingProfileRange(page, input, resultLimit)
        : await collectSearchResults(page, resultLimit);
      return { items, total: items.length };
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
      const project = extractProject(html, url);
      project.profileProjectCount = (await fetchProfileProjectCount(page, html, project.profileProjectCount)) ?? project.profileProjectCount;

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
  const $ = cheerio.load(html);
  const links = $('a[href*="/projects/"][href*="/view"]')
    .toArray()
    .map((element) => {
      const url = absolutize($(element).attr('href') || '', CAMPFIRE_ORIGIN);
      const card = $(element).closest('article, li, div');
      const cardText = clean(card.text() || $(element).text());
      const title = clean($(element).find('h2,h3').first().text() || $(element).text()).slice(0, 140);
      const amount = parseInteger(findFirst(cardText, [/([0-9,]+)\s*円/g]));
      const supporterCount = parseInteger(findFirst(cardText, [/([0-9,]+)\s*人/g]));
      const daysLeftText = findFirst(cardText, [/残り\s*([0-9]+)\s*日/g, /あと\s*([0-9]+)\s*日/g]);
      const daysLeft = daysLeftText ? parseInteger(daysLeftText) : null;
      const isActive = !/(終了|募集終了|SUCCESS|失敗)/i.test(cardText);
      const profileProjectCount = extractProfileProjectCount(cardText);

      return {
        title: title || extractTitleFromUrl(url),
        url,
        amount,
        supporterCount,
        category: '',
        daysLeft,
        isActive,
        profileProjectCount,
        summary: cardText.slice(0, 180)
      };
    })
    .filter((item) => item.url && item.title);

  return uniqueBy(links, (item) => normalizeUrlForUnique(item.url));
}

async function collectSearchResults(page: Page, limit: number) {
  let items: CampfireSearchResult[] = [];
  let unchangedCount = 0;

  for (let attempt = 0; attempt < 8 && items.length < limit; attempt += 1) {
    const beforeCount = items.length;
    items = uniqueBy([...items, ...extractSearchResults(await page.content())], (item) => normalizeUrlForUnique(item.url));

    if (items.length >= limit) break;

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
    await page.waitForTimeout(1200);
    items = uniqueBy([...items, ...extractSearchResults(await page.content())], (item) => normalizeUrlForUnique(item.url));

    if (items.length >= limit) break;

    const clickedMore = await clickNextSearchResults(page);
    if (clickedMore) {
      await page.waitForTimeout(1600);
      items = uniqueBy([...items, ...extractSearchResults(await page.content())], (item) => normalizeUrlForUnique(item.url));
    }

    unchangedCount = items.length === beforeCount ? unchangedCount + 1 : 0;
    if (!clickedMore && unchangedCount >= 2) break;
  }

  return items.slice(0, limit);
}

async function collectSearchResultsMatchingProfileRange(page: Page, input: CampfireSearchInput, limit: number) {
  let items: CampfireSearchResult[] = [];
  let matched: CampfireSearchResult[] = [];
  let unchangedCount = 0;
  const checkedUrls = new Set<string>();
  const maxCandidates = Math.min(Math.max(limit * 10, 100), 300);
  const detailPage = await page.context().newPage();

  try {
    for (let attempt = 0; attempt < 20 && matched.length < limit && items.length < maxCandidates; attempt += 1) {
      const beforeCount = items.length;
      items = uniqueBy([...items, ...extractSearchResults(await page.content())], (item) => normalizeUrlForUnique(item.url));
      matched = await collectProfileMatchesFromCandidates(detailPage, items, input, checkedUrls, matched, limit);

      if (matched.length >= limit || items.length >= maxCandidates) break;

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
      await page.waitForTimeout(900);
      items = uniqueBy([...items, ...extractSearchResults(await page.content())], (item) => normalizeUrlForUnique(item.url));
      matched = await collectProfileMatchesFromCandidates(detailPage, items, input, checkedUrls, matched, limit);

      if (matched.length >= limit || items.length >= maxCandidates) break;

      const clickedMore = await clickNextSearchResults(page);
      if (clickedMore) {
        await page.waitForTimeout(1200);
        items = uniqueBy([...items, ...extractSearchResults(await page.content())], (item) => normalizeUrlForUnique(item.url));
        matched = await collectProfileMatchesFromCandidates(detailPage, items, input, checkedUrls, matched, limit);
      }

      unchangedCount = items.length === beforeCount ? unchangedCount + 1 : 0;
      if (!clickedMore && unchangedCount >= 2) break;
    }
  } finally {
    await detailPage.close().catch(() => undefined);
  }

  return matched;
}

async function collectProfileMatchesFromCandidates(
  page: Page,
  items: CampfireSearchResult[],
  input: CampfireSearchInput,
  checkedUrls: Set<string>,
  matched: CampfireSearchResult[],
  limit: number
) {
  const nextMatched = [...matched];
  const matchedUrls = new Set(nextMatched.map((item) => normalizeUrlForUnique(item.url)));

  for (const item of items) {
    if (nextMatched.length >= limit) break;

    const key = normalizeUrlForUnique(item.url);
    if (checkedUrls.has(key) || matchedUrls.has(key)) continue;
    checkedUrls.add(key);

    const enriched = item.profileProjectCount === null ? await enrichWithProjectPageProfileCount(page, item) : item;
    if (!matchesProfileProjectRange(enriched, input)) continue;

    nextMatched.push(enriched);
    matchedUrls.add(key);
  }

  return nextMatched;
}

async function enrichWithProjectPageProfileCount(page: Page, item: CampfireSearchResult) {
  try {
    await openPageFast(page, item.url);
    const text = (await page.locator('body').innerText({ timeout: 2500 })).replace(/\s+/g, ' ').trim();
    return { ...item, profileProjectCount: extractProfileProjectCount(text) };
  } catch {
    return item;
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

function hasProfileProjectFilter(input: CampfireSearchInput) {
  return typeof input.profileProjectMin === 'number' || typeof input.profileProjectMax === 'number';
}

function matchesProfileProjectRange(item: CampfireSearchResult, input: CampfireSearchInput) {
  if (!hasProfileProjectFilter(input)) return true;
  if (item.profileProjectCount === null) return false;
  if (typeof input.profileProjectMin === 'number' && item.profileProjectCount < input.profileProjectMin) return false;
  if (typeof input.profileProjectMax === 'number' && item.profileProjectCount > input.profileProjectMax) return false;
  return true;
}

async function fetchProfileProjectCount(
  page: Page,
  projectHtml: string,
  fallbackCount: number | null = null,
  strictProfileLookup = false
) {
  if (fallbackCount !== null) return fallbackCount;

  const profileUrl = extractProfileUrl(projectHtml);
  if (!profileUrl) return strictProfileLookup ? null : fallbackCount;

  try {
    await openPageFast(page, profileUrl);
    const profileText = (await page.locator('body').innerText({ timeout: 2500 })).replace(/\s+/g, ' ').trim();
    return extractProfileProjectCount(profileText) ?? fallbackCount;
  } catch {
    return strictProfileLookup ? null : fallbackCount;
  }
}

function normalizeText(value: string | undefined) {
  return (value || '').toLowerCase().replace(/\s+/g, '');
}

function extractTitleFromUrl(value: string) {
  return value.match(/projects\/([0-9]+)/)?.[1] ? `CAMPFIRE project ${value.match(/projects\/([0-9]+)/)?.[1]}` : value;
}

async function openPage(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
}

async function openPageFast(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
  await page.waitForLoadState('load', { timeout: 4000 }).catch(() => undefined);
  await page.waitForTimeout(600);
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

function extractProject(html: string, projectUrl: string): ScrapedCampfireProject {
  const $ = cheerio.load(html);
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const description = clean(
    $('meta[property="og:description"]').attr('content') ||
      $('[class*="description"], [class*="Description"]').first().text() ||
      $('main').text().slice(0, 1800)
  );
  const profileName = clean($('a[href*="/profile/"]').first().text());
  const urls = extractExternalUrls($, projectUrl);
  const classifiedUrls = classifyUrls(urls);
  const profileUrl = extractProfileUrl(html);
  const profileProjectCount = extractProfileProjectCount(bodyText);

  return {
    projectUrl,
    projectId: projectUrl.match(/projects\/(\d+)/)?.[1] ?? '',
    projectTitle: clean(
      $('meta[property="og:title"]').attr('content') ||
        $('h1').first().text() ||
        $('title').text().replace(/\s*\|\s*CAMPFIRE.*$/i, '')
    ),
    executorName:
      sanitizeName(profileName) || sanitizeName(pickNearLabel(bodyText, ['実行者', '起案者', 'プロジェクトオーナー'])),
    brandName: sanitizeName(pickNearLabel(bodyText, ['ブランド名', 'ショップ名'])),
    supportAmount: findFirst(bodyText, [/([0-9,]+)\s*円/g, /支援総額\s*([0-9,]+円)/g]),
    supporters: findFirst(bodyText, [/([0-9,]+)\s*人\s*(?:の)?支援者/g, /支援者数\s*([0-9,]+人)/g]),
    achievementRate: findFirst(bodyText, [/([0-9,]+)\s*%/g, /達成率\s*([0-9,]+%)/g]),
    daysLeft: findFirst(bodyText, [/残り\s*([0-9]+日)/g, /あと\s*([0-9]+日)/g]),
    mainDescription: description,
    category: pickNearLabel(bodyText, ['カテゴリー', 'カテゴリ']) || '',
    features: extractFeatureCandidates($, description),
    profileUrl,
    profileProjectCount,
    websiteUrl: classifiedUrls.websiteUrl,
    inquiryUrl: classifiedUrls.inquiryUrl,
    instagramUrl: classifiedUrls.instagramUrl,
    tiktokUrl: classifiedUrls.tiktokUrl,
    xUrl: classifiedUrls.xUrl,
    externalUrls: urls
  };
}

function extractProfileUrl(html: string) {
  const $ = cheerio.load(html);
  return absolutize(
    $('a[href*="/profile/"][href*="/projects"]').first().attr('href') ||
      $('a[href*="/profile/"]').first().attr('href') ||
      '',
    CAMPFIRE_ORIGIN
  );
}

function extractProfileProjectCount(text: string) {
  if (/初めてのプロジェクトです/.test(text)) {
    return 0;
  }

  const patterns = [
    /他に\s*([0-9,]+)\s*件のプロジェクトを掲載しています/g,
    /([0-9,]+)\s*件のプロジェクト/g,
    /プロジェクト\s*([0-9,]+)\s*件/g,
    /([0-9,]+)\s*projects?/gi
  ];

  const countText = findFirst(text, patterns);
  return countText ? parseInteger(countText) : null;
}

function extractExternalUrls($: cheerio.CheerioAPI, projectUrl: string) {
  const projectHost = new URL(projectUrl).hostname;
  const urls = $('a[href]')
    .toArray()
    .map((element) => absolutize($(element).attr('href') || '', CAMPFIRE_ORIGIN))
    .filter((url) => {
      if (!url) return false;
      const parsed = new URL(url);
      if (parsed.hostname === projectHost || parsed.hostname.endsWith('.camp-fire.jp')) return false;
      if (['mailto:', 'tel:'].includes(parsed.protocol)) return false;
      if (isShareOrTrackingUrl(parsed)) return false;
      return ['http:', 'https:'].includes(parsed.protocol);
    });

  return uniqueBy(urls, (value) => normalizeUrlForUnique(value)).slice(0, 20);
}

function classifyUrls(urls: string[]) {
  const cleanUrls = urls.filter((url) => {
    try {
      return !isShareOrTrackingUrl(new URL(url));
    } catch {
      return false;
    }
  });
  const instagramUrl = cleanUrls.find((url) => /(^|\.)instagram\.com$/i.test(new URL(url).hostname)) || '';
  const tiktokUrl = cleanUrls.find((url) => /(^|\.)tiktok\.com$/i.test(new URL(url).hostname)) || '';
  const xUrl =
    cleanUrls.find((url) => {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return (host === 'x.com' || host === 'twitter.com' || host.endsWith('.twitter.com')) && !parsed.pathname.toLowerCase().startsWith('/intent/');
    }) || '';
  const inquiryUrl =
    cleanUrls.find((url) => {
      const normalized = url.toLowerCase();
      return /contact|inquiry|toiawase|support|help|form|otoiawase/.test(normalized);
    }) || '';
  const websiteUrl =
    cleanUrls.find((url) => {
      const host = new URL(url).hostname.toLowerCase();
      return ![
        'instagram.com',
        'www.instagram.com',
        'tiktok.com',
        'www.tiktok.com',
        'x.com',
        'twitter.com',
        'www.twitter.com',
        'facebook.com',
        'www.facebook.com',
        'youtube.com',
        'www.youtube.com',
        'youtu.be'
      ].includes(host);
    }) || '';

  return { websiteUrl, inquiryUrl, instagramUrl, tiktokUrl, xUrl };
}

function isShareOrTrackingUrl(url: URL) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();

  if (host === 'x.com' || host === 'twitter.com' || host.endsWith('.twitter.com')) {
    return path.startsWith('/intent/') || path.startsWith('/share');
  }

  if (host === 'facebook.com' || host === 'www.facebook.com' || host.endsWith('.facebook.com')) {
    return path.includes('/sharer') || path.includes('/share');
  }

  if (host === 'social-plugins.line.me' || host.endsWith('.line.me')) {
    return path.includes('/share') || path.includes('/lineit');
  }

  if (host === 'app.adjust.com' || host.endsWith('.adjust.com')) return true;
  if (host === 'b.hatena.ne.jp' || host === 'pinterest.com' || host === 'www.pinterest.com') return true;

  return false;
}

function extractFeatureCandidates($: cheerio.CheerioAPI, description: string) {
  const headings = $('h2,h3,strong')
    .toArray()
    .map((element) => clean($(element).text()))
    .filter((value) => value.length >= 8 && value.length <= 80);
  const descriptionSentences = description
    .split(/[。！？!?]/)
    .map((value) => clean(value))
    .filter((value) => value.length >= 12 && value.length <= 90);

  return uniqueBy([...headings, ...descriptionSentences], (value) => value).slice(0, 8);
}

function pickNearLabel(text: string, labels: string[]) {
  for (const label of labels) {
    const match = text.match(new RegExp(label + '\\s*[:：]?\\s*([^\\s]{2,40})'));
    if (match?.[1]) {
      return clean(match[1]);
    }
  }

  return '';
}

function findFirst(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    pattern.lastIndex = 0;

    if (match?.[1]) {
      return clean(match[1]);
    }
  }

  return '';
}

function sanitizeName(value: string) {
  const text = clean(value);

  if (!text || text.length > 40) {
    return '';
  }

  if (/[。、「」]|メーカー|製造国|販売権|有する|http|CAMPFIRE/.test(text)) {
    return '';
  }

  return text;
}

function absolutize(href: string, origin: string) {
  if (!href) {
    return '';
  }

  try {
    return new URL(href, origin).toString();
  } catch {
    return '';
  }
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
