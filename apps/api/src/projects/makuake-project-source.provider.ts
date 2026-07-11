import { BadRequestException, Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { SearchCampfireProjectsDto } from './projects.dto';
import { NormalizedImportedProject, ProjectSourceProvider } from './project-source-provider';

const MAKUAKE_ORIGIN = 'https://www.makuake.com';
const MAKUAKE_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const MAKUAKE_CATEGORIES = [
  'プロダクト',
  'ガジェット',
  'フード',
  'ファッション',
  'ビューティー',
  'スポーツ',
  'アウトドア',
  'インテリア',
  '地域活性',
  '音楽',
  'アート',
  '映画',
  '出版',
  '教育'
].map((label) => ({ label, value: `preset:${label}` }));

const PREFECTURES = [
  '北海道',
  '青森',
  '岩手',
  '宮城',
  '秋田',
  '山形',
  '福島',
  '茨城',
  '栃木',
  '群馬',
  '埼玉',
  '千葉',
  '東京',
  '神奈川',
  '新潟',
  '富山',
  '石川',
  '福井',
  '山梨',
  '長野',
  '岐阜',
  '静岡',
  '愛知',
  '三重',
  '滋賀',
  '京都',
  '大阪',
  '兵庫',
  '奈良',
  '和歌山',
  '鳥取',
  '島根',
  '岡山',
  '広島',
  '山口',
  '徳島',
  '香川',
  '愛媛',
  '高知',
  '福岡',
  '佐賀',
  '長崎',
  '熊本',
  '大分',
  '宮崎',
  '鹿児島',
  '沖縄'
];

@Injectable()
export class MakuakeProjectSourceProvider implements ProjectSourceProvider {
  readonly source = 'makuake' as const;
  readonly name = 'Makuake';
  readonly baseUrl = MAKUAKE_ORIGIN;

  async categories() {
    return { items: [] };
  }

  async search(input: SearchCampfireProjectsDto) {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ userAgent: MAKUAKE_USER_AGENT });
      const rawItems = (
        await runWithConcurrency(buildMakuakeSearchUrls(input), 3, async (url) => {
          const page = await context.newPage();
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await page.waitForTimeout(900);
            return await collectSearchResultsFromPage(page);
          } catch {
            return [];
          } finally {
            await page.close().catch(() => undefined);
          }
        })
      ).flat();
      const candidates = sortSearchResults(uniqueBy(rawItems, (item) => normalizeUrlForUnique(item.url)), input)
        .filter((item) => matchesKeyword(item, input.keyword))
        .slice(0, Math.max(normalizeLimit(input.limit) * 2, 10));
      const enrichedItems = await enrichSearchResults(context, candidates);
      const excluded = new Set((input.excludeUrls || []).map((url) => normalizeUrlForUnique(url)));
      const items = sortSearchResults(enrichedItems, input)
        .filter((item) => !excluded.has(normalizeUrlForUnique(item.url)))
        .filter((item) => matchesNumericFilters(item, input))
        .slice(0, normalizeLimit(input.limit));
      return { items };
    } finally {
      await browser.close();
    }
  }

  async import(url: string): Promise<NormalizedImportedProject> {
    const normalizedUrl = validateMakuakeUrl(this.normalizeUrl(url));
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ userAgent: MAKUAKE_USER_AGENT });
      const page = await context.newPage();
      await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1200);
      const html = await page.content();
      const scraped = extractProject(html, normalizedUrl, await readVisibleText(page));
      const memberStats = await scrapeMemberStats(page, scraped.memberUrl);
      const enriched = { ...scraped, memberStats };

      return {
        source: this.source,
        platform: {
          type: 'makuake',
          name: this.name,
          baseUrl: this.baseUrl
        },
        company: {
          name: enriched.executorName || memberStats.name || 'Makuake実行者名未取得',
          websiteUrl: enriched.websiteUrl || undefined,
          inquiryUrl: enriched.inquiryUrl || undefined,
          memo: buildCompanyMemo(enriched)
        },
        project: {
          title: enriched.title,
          url: enriched.url,
          status: enriched.isEnded ? 'ended' : 'active',
          amount: enriched.amount,
          supporterCount: enriched.supporterCount,
          description: enriched.description || undefined,
          category: enriched.category || undefined,
          thumbnailUrl: enriched.thumbnailUrl || undefined,
          scrapedAt: new Date()
        },
        lead: {
          source: 'makuake_import',
          reason: buildImportReason(enriched),
          brandWebsiteUrl: enriched.websiteUrl || undefined,
          contactFormUrl: enriched.inquiryUrl || undefined,
          contactMemo: buildAutoUrlMemo(enriched),
          brandAnalysisMemo: buildMemberAnalysisMemo(enriched)
        },
        raw: enriched
      };
    } finally {
      await browser.close();
    }
  }

  normalizeUrl(url: string) {
    return validateMakuakeUrl(url.trim());
  }
}

type MakuakeSearchResult = {
  title: string;
  url: string;
  summary: string;
  amount: number;
  supporterCount: number;
  daysLeft: number | null;
  profileProjectCount: number | null;
  category: string;
  location: string;
};

type ScrapedMakuakeProject = {
  title: string;
  url: string;
  executorName: string;
  amount: number;
  supporterCount: number;
  daysLeft: number | null;
  isEnded: boolean;
  description: string;
  category: string;
  location: string;
  thumbnailUrl: string;
  websiteUrl: string;
  inquiryUrl: string;
  externalUrls: string[];
  memberUrl: string;
  memberStats: MakuakeMemberStats;
};

type MakuakeMemberStats = {
  url: string;
  name: string;
  totalAmount: number | null;
  projectCount: number | null;
  supporterCount: number | null;
  description: string;
};

function buildMakuakeSearchUrls(input: SearchCampfireProjectsDto) {
  const keyword = (input.keyword || '').trim();
  const urls: string[] = [];
  if (keyword) {
    const searchUrl = new URL('/search', MAKUAKE_ORIGIN);
    searchUrl.searchParams.set('keyword', keyword);
    urls.push(searchUrl.toString());
  }
  urls.push(
    new URL('/discover', MAKUAKE_ORIGIN).toString(),
    new URL('/project', MAKUAKE_ORIGIN).toString(),
    new URL('/', MAKUAKE_ORIGIN).toString()
  );
  return uniqueBy(urls, (url) => url);
}

async function collectSearchResultsFromPage(page: Page) {
  const items: MakuakeSearchResult[] = [];
  for (let index = 0; index < 4; index += 1) {
    try {
      items.push(...extractSearchResults(await page.content()));
      await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.85)));
      await page.waitForTimeout(350);
    } catch {
      break;
    }
  }
  return uniqueBy(items, (item) => normalizeUrlForUnique(item.url));
}

async function enrichSearchResults(context: BrowserContext, items: MakuakeSearchResult[]) {
  return runWithConcurrency(items, 4, async (item) => {
    if (item.amount > 0 && item.supporterCount > 0 && item.category && item.location) return item;
    const page = await context.newPage();
    try {
      await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(500);
      const text = await readVisibleText(page);
      return {
        ...item,
        amount: item.amount || extractAmount(text),
        supporterCount: item.supporterCount || extractSupporterCount(text),
        category: item.category || extractCategory(text),
        location: item.location || extractLocation(text)
      };
    } catch {
      return item;
    } finally {
      await page.close().catch(() => undefined);
    }
  });
}

function extractSearchResults(html: string): MakuakeSearchResult[] {
  const $ = cheerio.load(html);
  const items = $('a[href*="/project/"]')
    .toArray()
    .map((element) => {
      const url = absolutize($(element).attr('href') || '');
      const card = $(element).closest('article, li, div');
      const text = clean(card.text()) || clean($(element).text());
      const title = clean($(element).attr('title') || card.find('h1,h2,h3,[class*="title"]').first().text() || $(element).text());
      return {
        title: title || firstUsefulLine(text) || '案件名なし',
        url,
        summary: text.slice(0, 180),
        amount: extractAmount(text),
        supporterCount: extractSupporterCount(text),
        daysLeft: extractDaysLeft(text),
        profileProjectCount: null,
        category: extractCategory(text),
        location: extractLocation(text)
      };
    })
    .filter((item) => item.url && item.title && isProjectUrl(item.url))
    .filter((item) => item.daysLeft !== null && !/終了|募集終了|販売終了/.test(item.summary));
  return uniqueBy(items, (item) => normalizeUrlForUnique(item.url));
}

function extractProject(html: string, url: string, visibleText = ''): ScrapedMakuakeProject {
  const $ = cheerio.load(html);
  const title = clean($('meta[property="og:title"]').attr('content') || $('h1').first().text() || $('title').text());
  if (!title) throw new BadRequestException('Makuakeプロジェクト名を取得できませんでした。');
  const description = clean($('meta[property="og:description"]').attr('content') || $('[class*="description"], [class*="story"], main').first().text()).slice(0, 1600);
  const pageText = visibleText || clean($('body').text());
  const externalUrls = extractExternalUrls($, url);
  const memberUrl = extractMemberUrl($, url);
  return {
    title,
    url,
    executorName: extractExecutorName($, pageText),
    amount: extractAmount(pageText),
    supporterCount: extractSupporterCount(pageText),
    daysLeft: extractDaysLeft(pageText),
    isEnded: /終了|募集終了|販売終了/.test(pageText) && extractDaysLeft(pageText) === null,
    description,
    category: extractCategory(pageText),
    location: extractLocation(pageText),
    thumbnailUrl: $('meta[property="og:image"]').attr('content') || '',
    websiteUrl: externalUrls.find((item) => !/makuake\.com|twitter\.com|x\.com|instagram\.com|facebook\.com|youtube\.com/.test(item)) || '',
    inquiryUrl: externalUrls.find((item) => /contact|inquiry|お問い合わせ/.test(item)) || '',
    externalUrls,
    memberUrl,
    memberStats: emptyMemberStats(memberUrl)
  };
}

function extractExecutorName($: cheerio.CheerioAPI, text: string) {
  const labelMatch = text.match(/(?:実行者|販売者|メーカー|起案者|事業者)\s*[:：]?\s*([^\s　]{2,40})/);
  if (labelMatch?.[1]) return clean(labelMatch[1]);
  return clean($('[class*="owner"], [class*="seller"], [class*="maker"], [class*="executor"], [class*="profile"]').first().text()).slice(0, 60);
}

function buildImportReason(scraped: ScrapedMakuakeProject) {
  const values = [
    scraped.amount ? `応援購入総額: ${scraped.amount.toLocaleString()}円` : '',
    scraped.daysLeft !== null ? `残り日数: ${scraped.daysLeft}日` : '',
    scraped.memberStats.projectCount !== null ? `実行者プロジェクト数: ${scraped.memberStats.projectCount}件` : '',
    scraped.memberStats.supporterCount !== null ? `実行者サポーター数: ${scraped.memberStats.supporterCount.toLocaleString()}人` : '',
    scraped.location ? `所在地: ${scraped.location}` : '',
    scraped.category ? `カテゴリ: ${scraped.category}` : ''
  ].filter(Boolean);
  return values.join(' / ') || 'Makuake import';
}

function buildCompanyMemo(scraped: ScrapedMakuakeProject) {
  const stats = scraped.memberStats;
  const lines = [
    scraped.executorName ? `Makuake executor: ${scraped.executorName}` : '',
    stats.totalAmount !== null ? `Makuake応援購入総額: ${stats.totalAmount.toLocaleString()}円` : '',
    stats.projectCount !== null ? `Makuakeプロジェクト数: ${stats.projectCount}件` : '',
    stats.supporterCount !== null ? `Makuakeサポーター数: ${stats.supporterCount.toLocaleString()}人` : '',
    scraped.location ? `Makuake所在地: ${scraped.location}` : '',
    stats.url ? `Makuake member URL: ${stats.url}` : ''
  ].filter(Boolean);
  return lines.join('\n') || undefined;
}

function buildMemberAnalysisMemo(scraped: ScrapedMakuakeProject) {
  const stats = scraped.memberStats;
  const lines = [
    stats.projectCount !== null ? `Makuake実行者の累計プロジェクト数: ${stats.projectCount}件` : '',
    stats.totalAmount !== null ? `Makuake実行者の応援購入総額: ${stats.totalAmount.toLocaleString()}円` : '',
    stats.supporterCount !== null ? `Makuake実行者の累計サポーター数: ${stats.supporterCount.toLocaleString()}人` : '',
    scraped.location ? `所在地: ${scraped.location}` : '',
    stats.description ? `実行者紹介: ${stats.description.slice(0, 240)}` : ''
  ].filter(Boolean);
  return lines.join('\n') || undefined;
}

function buildAutoUrlMemo(scraped: ScrapedMakuakeProject) {
  const urls = uniqueBy([scraped.memberUrl, ...scraped.externalUrls].filter(Boolean), normalizeUrlForUnique);
  return urls.length ? `Makuakeページから自動取得したURL: ${urls.slice(0, 8).join(' / ')}` : undefined;
}

function matchesNumericFilters(item: MakuakeSearchResult, input: SearchCampfireProjectsDto) {
  if (typeof input.amountMin === 'number' && item.amount < input.amountMin) return false;
  if (typeof input.amountMax === 'number' && item.amount > input.amountMax) return false;
  if (typeof input.supporterMin === 'number' && item.supporterCount < input.supporterMin) return false;
  if (typeof input.supporterMax === 'number' && item.supporterCount > input.supporterMax) return false;
  return true;
}

function matchesKeyword(item: MakuakeSearchResult, keyword?: string) {
  const value = clean(keyword);
  if (!value) return true;
  const haystack = `${item.title} ${item.summary} ${item.category}`.toLowerCase();
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

function sortSearchResults(items: MakuakeSearchResult[], input: SearchCampfireProjectsDto) {
  if (input.status !== 'endingSoon') return items;
  const maxDays = normalizeEndingSoonDays(input.endingSoonDays);
  return [...items]
    .filter((item) => typeof item.daysLeft === 'number' && item.daysLeft <= maxDays)
    .sort((a, b) => Number(a.daysLeft) - Number(b.daysLeft));
}

function normalizeEndingSoonDays(value?: number) {
  const number = Number(value);
  return [7, 14, 20, 30].includes(number) ? number : 14;
}

function validateMakuakeUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException('MakuakeのURL形式が正しくありません。');
  }
  if (!['makuake.com', 'www.makuake.com'].includes(url.hostname) || !isProjectUrl(url.toString())) {
    throw new BadRequestException('MakuakeのプロジェクトURLを入力してください。');
  }
  return url.toString();
}

function isProjectUrl(url: string) {
  return /makuake\.com\/project\/[^/?#]+/i.test(url);
}

function extractAmount(text: string) {
  const match =
    extractNumberAfterLabels(text, ['応援購入総額', '集まっている金額', '現在の支援総額', '購入総額', '支援総額'], ['円'], 160) ||
    matchYenAmount(text) ||
    text.match(/([0-9,]+)\s*円/);
  return match?.[1] ? Number(match[1].replace(/,/g, '')) : 0;
}

function matchYenAmount(text: string) {
  const commaAmountMatch = text.match(/[¥￥]\s*([0-9]{1,3}(?:,[0-9]{3})+)(?:円|[0-9]{1,3}\s*日|[0-9]{1,6}\s*%|$)/);
  if (commaAmountMatch?.[1]) return commaAmountMatch;
  const match = text.match(/[¥￥]\s*([0-9]+?)(?:円|(?=[0-9]{1,3}\s*日)|(?=[0-9]{1,6}\s*%))/);
  if (match?.[1]) return match;
  return text.match(/[¥￥]\s*([0-9]{1,3}(?:,[0-9]{3})+)/);
}

function extractSupporterCount(text: string) {
  const match =
    extractNumberAfterLabels(text, ['サポーター', '寄附者', '寄付者', 'サポーター数', '支援者数', '応援購入者数', '支援者', '応援購入者'], ['人', '名'], 160) ||
    text.match(/(?:寄附者|寄付者|サポーター数|支援者数|応援購入者数|サポーター|支援者|応援購入者)\s*[:：]?\s*([0-9,]+)\s*(?:人|名)?/) ||
    text.match(/([0-9,]+)\s*(?:人|名)\s*(?:の)?(?:寄附者|寄付者|サポーター|応援購入者|購入者|支援者)/);
  return match?.[1] ? Number(match[1].replace(/,/g, '')) : 0;
}

function extractNumberAfterLabels(text: string, labels: string[], units: string[], windowSize = 80) {
  for (const label of labels) {
    const index = text.indexOf(label);
    if (index < 0) continue;
    const nearby = text.slice(index + label.length, index + label.length + windowSize);
    const unitPattern = units.map(escapeRegExp).join('|');
    const match = nearby.match(new RegExp(`([0-9,]+)\\s*(?:${unitPattern})`));
    if (match?.[1]) return match;
  }
  return null;
}

function extractDaysLeft(text: string) {
  const match = extractNumberAfterLabels(text, ['募集終了まで残り', '終了まで残り', '残り', 'あと'], ['日'], 80) ||
    text.match(/(?:残り|あと)\s*([0-9]{1,3})\s*日/);
  if (match?.[1]) return Number(match[1]);
  const compactAmountMatch = matchCompactAmountDaysRate(text);
  if (compactAmountMatch !== null) return compactAmountMatch;
  const compactCardMatch = text.match(/(?:^|[^0-9,¥￥])([0-9]{1,3})\s*日\s*[0-9]{1,6}\s*%/);
  if (compactCardMatch?.[1]) return Number(compactCardMatch[1]);
  const daysBeforeRateMatch = text.match(/(?:^|[^0-9,¥￥])([0-9]{1,3})\s*日\s*(?:達成率|[0-9]{1,6}\s*%)/);
  return daysBeforeRateMatch?.[1] ? Number(daysBeforeRateMatch[1]) : null;
}

function matchCompactAmountDaysRate(text: string) {
  const normalized = clean(text);
  const commaAmountPattern = /[¥￥]\s*[0-9]{1,3}(?:,[0-9]{3})+\s*(?:円)?\s*([0-9]{1,3})\s*日\s*[0-9]{1,6}\s*%/;
  const commaMatch = normalized.match(commaAmountPattern);
  if (commaMatch?.[1]) return Number(commaMatch[1]);

  const compactNumberMatch = normalized.match(/[¥￥]\s*([0-9]+)\s*日\s*[0-9]{1,6}\s*%/);
  if (!compactNumberMatch?.[1]) return null;
  const amountAndDays = compactNumberMatch[1];
  for (const digitLength of [3, 2, 1]) {
    if (amountAndDays.length <= digitLength) continue;
    const days = Number(amountAndDays.slice(-digitLength));
    if (days >= 1 && days <= 365) return days;
  }
  return null;
}

function extractCategory(text: string) {
  return MAKUAKE_CATEGORIES.find((item) => text.includes(item.label))?.label || '';
}

function extractLocation(text: string) {
  const normalized = clean(text);
  const locationLabelMatch = normalized.match(/(?:所在地|活動拠点|拠点|地域)\s*[:：]?\s*([^\s　、。/#]{2,12})/);
  if (locationLabelMatch?.[1]) {
    const labeled = normalizePrefecture(locationLabelMatch[1]);
    if (labeled) return labeled;
  }
  for (const prefecture of PREFECTURES) {
    const suffixPattern = prefecture === '北海道' ? '北海道' : `${prefecture}(?:都|府|県)?`;
    if (new RegExp(`(?:^|\\s|#|、|。)${suffixPattern}(?:\\s|#|、|。|$)`).test(normalized)) return prefecture;
  }
  return '';
}

function normalizePrefecture(value: string) {
  const cleaned = clean(value).replace(/[都府県]$/, '');
  if (value.includes('北海道')) return '北海道';
  return PREFECTURES.find((prefecture) => prefecture === cleaned || value.includes(prefecture)) || '';
}

function extractExternalUrls($: cheerio.CheerioAPI, currentUrl: string) {
  return uniqueBy(
    $('a[href^="http"]')
      .toArray()
      .map((element) => $(element).attr('href') || '')
      .filter((url) => url && url !== currentUrl),
    (url) => normalizeUrlForUnique(url)
  ).slice(0, 20);
}

function extractMemberUrl($: cheerio.CheerioAPI, currentUrl: string) {
  const href = $('a[href*="/member/index/"]').first().attr('href') || '';
  return href ? absolutize(href) : inferMemberUrlFromText($('body').html() || '', currentUrl);
}

function inferMemberUrlFromText(html: string, currentUrl: string) {
  const match = html.match(/\/member\/index\/[0-9]+/);
  if (match?.[0]) return absolutize(match[0]);
  try {
    const current = new URL(currentUrl);
    const memberId = current.searchParams.get('member_id');
    return memberId ? absolutize(`/member/index/${memberId}/#project`) : '';
  } catch {
    return '';
  }
}

async function scrapeMemberStats(projectPage: Page, memberUrl: string): Promise<MakuakeMemberStats> {
  if (!memberUrl) return emptyMemberStats('');
  const page = await projectPage.context().newPage();
  try {
    await page.goto(memberUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(800);
    return extractMemberStats(await page.content(), memberUrl);
  } catch {
    return emptyMemberStats(memberUrl);
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function readVisibleText(page: Page) {
  const text = await page
    .evaluate(() => document.body?.innerText || document.body?.textContent || '')
    .catch(() => '');
  return clean(text);
}

function extractMemberStats(html: string, url: string): MakuakeMemberStats {
  const $ = cheerio.load(html);
  const text = clean($('body').text());
  return {
    url,
    name: clean($('h1,h2,[class*="name"],[class*="Name"]').first().text()).slice(0, 80),
    totalAmount: extractLabeledNumber(text, ['応援購入総額', '購入総額']),
    projectCount: extractLabeledNumber(text, ['プロジェクト数']),
    supporterCount: extractLabeledNumber(text, ['サポーター数', '応援購入者数']),
    description: extractMemberDescription($, text)
  };
}

function emptyMemberStats(url: string): MakuakeMemberStats {
  return {
    url,
    name: '',
    totalAmount: null,
    projectCount: null,
    supporterCount: null,
    description: ''
  };
}

function extractLabeledNumber(text: string, labels: string[]) {
  for (const label of labels) {
    const index = text.indexOf(label);
    if (index < 0) continue;
    const nearby = text.slice(index, index + 80);
    const match = nearby.match(/([0-9,]+)\s*(?:円|件|人)?/);
    if (match?.[1]) return Number(match[1].replace(/,/g, ''));
  }
  return null;
}

function extractMemberDescription($: cheerio.CheerioAPI, text: string) {
  const candidates = [
    clean($('[class*="profile"], [class*="Profile"], [class*="description"], [class*="Description"], [class*="introduction"], [class*="Introduction"]').first().text()),
    text.match(/サポーター数\s*[0-9,]+人\s*(.{40,500})/)?.[1] || ''
  ];
  return candidates.find((value) => value && value.length >= 30)?.slice(0, 600) || '';
}

function absolutize(value: string) {
  try {
    return new URL(value, MAKUAKE_ORIGIN).toString();
  } catch {
    return '';
  }
}

function normalizeLimit(value?: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 10;
  return Math.max(10, Math.min(200, Math.floor(number)));
}

function firstUsefulLine(text: string) {
  return text.split(/\s+/).find((line) => line.length >= 6 && line.length <= 80) || '';
}

function clean(value?: string) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function runWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      const current = items[cursor];
      cursor += 1;
      results[index] = await worker(current);
    }
  });
  await Promise.all(workers);
  return results;
}
