import { BadRequestException, Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
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

@Injectable()
export class MakuakeProjectSourceProvider implements ProjectSourceProvider {
  readonly source = 'makuake' as const;
  readonly name = 'Makuake';
  readonly baseUrl = MAKUAKE_ORIGIN;

  async categories() {
    return { items: MAKUAKE_CATEGORIES };
  }

  async search(input: SearchCampfireProjectsDto) {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ userAgent: MAKUAKE_USER_AGENT });
      const page = await context.newPage();
      await page.goto(buildMakuakeSearchUrl(input), { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1200);
      const html = await page.content();
      const excluded = new Set((input.excludeUrls || []).map((url) => normalizeUrlForUnique(url)));
      const items = extractSearchResults(html)
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
      const scraped = extractProject(html, normalizedUrl);

      return {
        source: this.source,
        platform: {
          type: 'makuake',
          name: this.name,
          baseUrl: this.baseUrl
        },
        company: {
          name: scraped.executorName || 'Makuake実行者名未取得',
          websiteUrl: scraped.websiteUrl || undefined,
          inquiryUrl: scraped.inquiryUrl || undefined,
          memo: scraped.executorName ? `Makuake executor: ${scraped.executorName}` : undefined
        },
        project: {
          title: scraped.title,
          url: scraped.url,
          status: scraped.isEnded ? 'ended' : 'active',
          amount: scraped.amount,
          supporterCount: scraped.supporterCount,
          description: scraped.description || undefined,
          category: scraped.category || undefined,
          thumbnailUrl: scraped.thumbnailUrl || undefined,
          scrapedAt: new Date()
        },
        lead: {
          source: 'makuake_import',
          reason: buildImportReason(scraped),
          brandWebsiteUrl: scraped.websiteUrl || undefined,
          contactFormUrl: scraped.inquiryUrl || undefined,
          contactMemo: buildAutoUrlMemo(scraped.externalUrls)
        },
        raw: scraped
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
  thumbnailUrl: string;
  websiteUrl: string;
  inquiryUrl: string;
  externalUrls: string[];
};

function buildMakuakeSearchUrl(input: SearchCampfireProjectsDto) {
  const url = new URL('/search', MAKUAKE_ORIGIN);
  const keyword = [input.keyword, normalizePresetCategory(input.category)].filter(Boolean).join(' ').trim();
  if (keyword) url.searchParams.set('keyword', keyword);
  return url.toString();
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
        category: extractCategory(text)
      };
    })
    .filter((item) => item.url && item.title && isProjectUrl(item.url))
    .filter((item) => item.daysLeft !== null && !/終了|募集終了|販売終了/.test(item.summary));
  return uniqueBy(items, (item) => normalizeUrlForUnique(item.url));
}

function extractProject(html: string, url: string): ScrapedMakuakeProject {
  const $ = cheerio.load(html);
  const title = clean($('meta[property="og:title"]').attr('content') || $('h1').first().text() || $('title').text());
  if (!title) throw new BadRequestException('Makuakeプロジェクト名を取得できませんでした。');
  const description = clean($('meta[property="og:description"]').attr('content') || $('[class*="description"], [class*="story"], main').first().text()).slice(0, 1600);
  const pageText = clean($('body').text());
  const externalUrls = extractExternalUrls($, url);
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
    thumbnailUrl: $('meta[property="og:image"]').attr('content') || '',
    websiteUrl: externalUrls.find((item) => !/makuake\.com|twitter\.com|x\.com|instagram\.com|facebook\.com|youtube\.com/.test(item)) || '',
    inquiryUrl: externalUrls.find((item) => /contact|inquiry|お問い合わせ/.test(item)) || '',
    externalUrls
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
    scraped.category ? `カテゴリ: ${scraped.category}` : ''
  ].filter(Boolean);
  return values.join(' / ') || 'Makuake import';
}

function buildAutoUrlMemo(externalUrls: string[]) {
  return externalUrls.length ? `Makuakeページから自動取得したURL: ${externalUrls.slice(0, 8).join(' / ')}` : undefined;
}

function matchesNumericFilters(item: MakuakeSearchResult, input: SearchCampfireProjectsDto) {
  if (typeof input.amountMin === 'number' && item.amount < input.amountMin) return false;
  if (typeof input.amountMax === 'number' && item.amount > input.amountMax) return false;
  if (typeof input.supporterMin === 'number' && item.supporterCount < input.supporterMin) return false;
  if (typeof input.supporterMax === 'number' && item.supporterCount > input.supporterMax) return false;
  return true;
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
  const match = text.match(/(?:応援購入総額|購入総額|支援総額|現在の支援総額)?\s*([0-9,]+)\s*円/);
  return match?.[1] ? Number(match[1].replace(/,/g, '')) : 0;
}

function extractSupporterCount(text: string) {
  const match = text.match(/([0-9,]+)\s*(?:人|名)\s*(?:の)?(?:サポーター|応援購入|購入者|支援者)?/);
  return match?.[1] ? Number(match[1].replace(/,/g, '')) : 0;
}

function extractDaysLeft(text: string) {
  const match = text.match(/(?:残り|あと)\s*([0-9]+)\s*日/);
  return match?.[1] ? Number(match[1]) : null;
}

function extractCategory(text: string) {
  return MAKUAKE_CATEGORIES.find((item) => text.includes(item.label))?.label || '';
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

function absolutize(value: string) {
  try {
    return new URL(value, MAKUAKE_ORIGIN).toString();
  } catch {
    return '';
  }
}

function normalizeLimit(value?: number) {
  return [10, 50, 100].includes(Number(value)) ? Number(value) : 10;
}

function normalizePresetCategory(value?: string) {
  if (!value?.startsWith('preset:')) return '';
  return value.replace(/^preset:/, '').trim();
}

function firstUsefulLine(text: string) {
  return text.split(/\s+/).find((line) => line.length >= 6 && line.length <= 80) || '';
}

function clean(value?: string) {
  return (value || '').replace(/\s+/g, ' ').trim();
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

