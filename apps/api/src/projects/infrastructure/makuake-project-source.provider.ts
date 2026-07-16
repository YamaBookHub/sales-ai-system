import { BadRequestException, Injectable } from '@nestjs/common';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { runWithConcurrency } from '../../common/concurrency';
import { NormalizedImportedProject, ProjectSourceProvider } from '../domain/project-source-provider';
import { SearchCampfireProjectsDto } from '../projects.dto';
import { parseMakuakeDetail } from './parsers/makuake/makuake-detail.parser';
import { isActiveMakuakeListing, parseMakuakeListing } from './parsers/makuake/makuake-listing.parser';
import { parseMakuakeProfile } from './parsers/makuake/makuake-profile.parser';
import { MAKUAKE_ORIGIN, clean, normalizeUrlForUnique, uniqueBy } from './parsers/makuake/makuake-parser.utils';

const MAKUAKE_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

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
      const candidatePoolSize = searchCandidatePoolSize(input);
      const candidates = sortSearchResults(uniqueBy(rawItems, (item) => normalizeUrlForUnique(item.url)), input)
        .filter((item) => matchesKeyword(item, input.keyword))
        .slice(0, candidatePoolSize);
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
          location: enriched.location || undefined,
          sourceTotalAmount: memberStats.totalAmount,
          sourceProjectCount: memberStats.projectCount,
          sourceSupporterCount: memberStats.supporterCount,
          memo: buildCompanyMemo(enriched)
        },
        project: {
          title: enriched.title,
          url: enriched.url,
          status: enriched.isEnded ? 'ended' : 'active',
          amount: enriched.amount,
          supporterCount: enriched.supporterCount,
          daysLeft: enriched.daysLeft,
          description: enriched.description || undefined,
          category: enriched.category || undefined,
          location: enriched.location || undefined,
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
  statusText: string;
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
      const parsed = parseMakuakeDetail({
        source: 'makuake',
        kind: 'detail',
        url: item.url,
        html: '',
        visibleText: text
      }).value;
      const metrics = normalizeParsedMetrics(parsed);
      return {
        ...item,
        amount: item.amount || metrics.amount,
        supporterCount: item.supporterCount || metrics.supporterCount,
        daysLeft: item.daysLeft ?? metrics.daysLeft,
        category: item.category || parsed.category,
        location: item.location || parsed.location
      };
    } catch {
      return item;
    } finally {
      await page.close().catch(() => undefined);
    }
  });
}

function extractSearchResults(html: string): MakuakeSearchResult[] {
  const parsed = parseMakuakeListing({
    source: 'makuake',
    kind: 'listing',
    url: MAKUAKE_ORIGIN,
    html
  });
  const items = parsed.value
    .filter(isActiveMakuakeListing)
    .map((item) => ({
      title: item.title,
      url: item.url,
      summary: item.summary,
      amount: parseMetricNumber(item.amountText),
      supporterCount: parseMetricNumber(item.supporterCountText),
      daysLeft: parseOptionalMetricNumber(item.daysLeftText),
      profileProjectCount: null,
      category: item.category,
      location: item.location,
      statusText: item.statusText
    }))
    .filter((item) => item.url && item.title && isProjectUrl(item.url));
  return uniqueBy(items, (item) => normalizeUrlForUnique(item.url));
}

function extractProject(html: string, url: string, visibleText = ''): ScrapedMakuakeProject {
  const parsed = parseMakuakeDetail({
    source: 'makuake',
    kind: 'detail',
    url,
    html,
    visibleText
  });
  const detail = parsed.value;
  const daysLeft = parseOptionalMetricNumber(detail.daysLeftText);
  if (!detail.title) throw new BadRequestException('Makuakeプロジェクト名を取得できませんでした。');
  return {
    title: detail.title,
    url: detail.url,
    executorName: detail.executorName,
    amount: parseMetricNumber(detail.amountText),
    supporterCount: parseMetricNumber(detail.supporterCountText),
    daysLeft,
    isEnded: /終了|募集終了|販売終了/.test(detail.statusText) && daysLeft === null,
    description: detail.description,
    category: detail.category,
    location: detail.location,
    thumbnailUrl: detail.thumbnailUrl,
    websiteUrl: detail.websiteUrl,
    inquiryUrl: detail.inquiryUrl,
    externalUrls: detail.externalUrls,
    memberUrl: detail.memberUrl,
    memberStats: emptyMemberStats(detail.memberUrl)
  };
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

function searchCandidatePoolSize(input: SearchCampfireProjectsDto) {
  const limit = normalizeLimit(input.limit);
  if (input.status === 'endingSoon') return Math.min(200, Math.max(limit * 8, 80));
  return Math.min(200, Math.max(limit * 4, 40));
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

function normalizeParsedMetrics(parsed: { amountText: string | null; supporterCountText: string | null; daysLeftText: string | null }) {
  return {
    amount: parseMetricNumber(parsed.amountText),
    supporterCount: parseMetricNumber(parsed.supporterCountText),
    daysLeft: parseOptionalMetricNumber(parsed.daysLeftText)
  };
}

function parseMetricNumber(value: string | null) {
  const match = value?.match(/[0-9,]+/);
  return match?.[0] ? Number(match[0].replace(/,/g, '')) : 0;
}

function parseOptionalMetricNumber(value: string | null) {
  return value ? parseMetricNumber(value) : null;
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
  const parsed = parseMakuakeProfile({
    source: 'makuake',
    kind: 'profile',
    url,
    html
  }).value;
  return {
    url,
    name: parsed.name,
    totalAmount: parseOptionalMetricNumber(parsed.totalAmountText),
    projectCount: parseOptionalMetricNumber(parsed.projectCountText),
    supporterCount: parseOptionalMetricNumber(parsed.supporterCountText),
    description: parsed.description
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

function normalizeLimit(value?: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 10;
  return Math.max(10, Math.min(200, Math.floor(number)));
}
