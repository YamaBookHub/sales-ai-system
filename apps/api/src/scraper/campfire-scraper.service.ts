import { BadRequestException, Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { chromium, type Page } from 'playwright';

const CAMPFIRE_ORIGIN = 'https://camp-fire.jp';
const SEARCH_RESULT_LIMIT = 30;
const PROFILE_FILTER_RESULT_LIMIT = 10;

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
  profileProjectCount: number;
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
      const page = await browser.newPage({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
      });
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
      const page = await browser.newPage({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
      });
      await openPage(page, buildCampfireSearchUrl(input.keyword, input.category));
      const html = await page.content();
      const resultLimit = hasProfileProjectFilter(input) ? PROFILE_FILTER_RESULT_LIMIT : SEARCH_RESULT_LIMIT;
      const candidates = extractSearchResults(html).filter((item) => matchesSearchInput(item, input)).slice(0, resultLimit);
      const enriched = hasProfileProjectFilter(input) ? await enrichWithProfileProjectCounts(page, candidates) : candidates;
      const items = enriched.filter((item) => matchesProfileProjectRange(item, input));
      return { items, total: items.length };
    } finally {
      await browser.close();
    }
  }

  async scrape(inputUrl: string): Promise<ScrapedCampfireProject> {
    const url = validateCampfireUrl(inputUrl);
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
      });
      await openPage(page, url);
      const html = await page.content();
      const project = extractProject(html, url);
      project.profileProjectCount = await fetchProfileProjectCount(page, html, project.profileProjectCount);

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

      return {
        title: title || extractTitleFromUrl(url),
        url,
        amount,
        supporterCount,
        category: '',
        daysLeft,
        isActive,
        profileProjectCount: null,
        summary: cardText.slice(0, 180)
      };
    })
    .filter((item) => item.url && item.title);

  return uniqueBy(links, (item) => normalizeUrlForUnique(item.url));
}

function matchesSearchInput(item: CampfireSearchResult, input: CampfireSearchInput) {
  const category = normalizeCampfireCategoryUrl(input.category) || normalizePresetCategory(input.category) ? '' : normalizeText(input.category);
  const haystack = normalizeText([item.title, item.summary, item.category, item.url].join(' '));

  if (category && !haystack.includes(category)) return false;
  if (typeof input.amountMin === 'number' && item.amount < input.amountMin) return false;
  if (typeof input.amountMax === 'number' && item.amount > input.amountMax) return false;
  if (typeof input.supporterMin === 'number' && item.supporterCount < input.supporterMin) return false;
  if (typeof input.supporterMax === 'number' && item.supporterCount > input.supporterMax) return false;
  if (input.status === 'active' && !item.isActive) return false;
  if (input.status === 'endingSoon' && (item.daysLeft === null || item.daysLeft > 7)) return false;
  return true;
}

function hasProfileProjectFilter(input: CampfireSearchInput) {
  return typeof input.profileProjectMin === 'number' || typeof input.profileProjectMax === 'number';
}

async function enrichWithProfileProjectCounts(page: Page, items: CampfireSearchResult[]) {
  const enriched: CampfireSearchResult[] = [];
  for (const item of items) {
    try {
      await openPageFast(page, item.url);
      const html = await page.content();
      const fallbackText = (await page.locator('body').innerText({ timeout: 2500 })).replace(/\s+/g, ' ').trim();
      const fallbackCount = extractProfileProjectCount(fallbackText);
      enriched.push({ ...item, profileProjectCount: await fetchProfileProjectCount(page, html, fallbackCount) });
    } catch {
      enriched.push(item);
    }
  }
  return enriched;
}

async function fetchProfileProjectCount(page: Page, projectHtml: string, fallbackCount = 0) {
  const profileUrl = extractProfileUrl(projectHtml);
  if (!profileUrl) return fallbackCount;

  try {
    await openPageFast(page, profileUrl);
    const profileText = (await page.locator('body').innerText({ timeout: 2500 })).replace(/\s+/g, ' ').trim();
    return extractProfileProjectCount(profileText) || fallbackCount;
  } catch {
    return fallbackCount;
  }
}

function matchesProfileProjectRange(item: CampfireSearchResult, input: CampfireSearchInput) {
  if (!hasProfileProjectFilter(input)) return true;
  if (item.profileProjectCount === null) return false;
  if (typeof input.profileProjectMin === 'number' && item.profileProjectCount < input.profileProjectMin) return false;
  if (typeof input.profileProjectMax === 'number' && item.profileProjectCount > input.profileProjectMax) return false;
  return true;
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
  const patterns = [
    /他に\s*([0-9,]+)\s*件のプロジェクトを掲載しています/g,
    /([0-9,]+)\s*件のプロジェクト/g,
    /プロジェクト\s*([0-9,]+)\s*件/g,
    /([0-9,]+)\s*projects?/gi
  ];

  return parseInteger(findFirst(text, patterns));
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
      return ['http:', 'https:'].includes(parsed.protocol);
    });

  return uniqueBy(urls, (value) => normalizeUrlForUnique(value)).slice(0, 20);
}

function classifyUrls(urls: string[]) {
  const instagramUrl = urls.find((url) => /(^|\.)instagram\.com$/i.test(new URL(url).hostname)) || '';
  const tiktokUrl = urls.find((url) => /(^|\.)tiktok\.com$/i.test(new URL(url).hostname)) || '';
  const xUrl =
    urls.find((url) => {
      const host = new URL(url).hostname.toLowerCase();
      return host === 'x.com' || host === 'twitter.com' || host.endsWith('.twitter.com');
    }) || '';
  const inquiryUrl =
    urls.find((url) => {
      const normalized = url.toLowerCase();
      return /contact|inquiry|toiawase|support|help|form|otoiawase/.test(normalized);
    }) || '';
  const websiteUrl =
    urls.find((url) => {
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
