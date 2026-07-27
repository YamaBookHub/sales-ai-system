import { BadRequestException, Injectable } from '@nestjs/common';
import { OperationAbortedError } from '../../common/abortable-resource';
import { runWithConcurrency } from '../../common/concurrency';
import {
  NormalizedImportedProject,
  ProjectSearchCriteria,
  ProjectSearchOptions,
  ProjectSourceProvider,
  ProjectSourceSearchResult
} from '../domain/project-source-provider';
import { parseGreenFundingDetail } from './parsers/green-funding/green-funding-detail.parser';
import {
  hasNextGreenFundingListingPage,
  parseGreenFundingCategories,
  parseGreenFundingListing
} from './parsers/green-funding/green-funding-listing.parser';
import {
  GREEN_FUNDING_ORIGIN,
  clean,
  normalizeUrlForUnique,
  parseGreenFundingDaysLeft,
  parseMetricNumber,
  uniqueBy
} from './parsers/green-funding/green-funding-parser.utils';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const SEARCH_CONCURRENCY = 3;

type GreenFundingSearchItem = ProjectSourceSearchResult['items'][number];

@Injectable()
export class GreenFundingProjectSourceProvider implements ProjectSourceProvider {
  readonly source = 'green_funding' as const;
  readonly name = 'GREEN FUNDING';
  readonly baseUrl = GREEN_FUNDING_ORIGIN;
  readonly capabilities = {
    keywordSearch: true,
    categoryFilter: true,
    endingSoonFilter: true,
    amountFilter: true,
    supporterFilter: true,
    profileProjectCountFilter: false,
    progressiveResults: true,
    cancellation: true
  } as const;

  async categories() {
    const html = await fetchHtml(buildSearchUrl({}, 1));
    return { items: parseGreenFundingCategories(html) };
  }

  async search(input: ProjectSearchCriteria, options: ProjectSearchOptions = {}) {
    throwIfAborted(options.signal);
    const limit = normalizeLimit(input.limit);
    const excluded = new Set((input.excludeUrls || []).map(normalizeUrlForUnique));
    const accepted = new Map<string, GreenFundingSearchItem>();
    let sourceCandidateCount = 0;
    let conditionMatchedCount = 0;
    let excludedCount = 0;
    let scanComplete = false;
    const maxPages = 50;

    for (let pageStart = 1; pageStart <= maxPages; pageStart += SEARCH_CONCURRENCY) {
      throwIfAborted(options.signal);
      const pageNumbers = Array.from(
        { length: Math.min(SEARCH_CONCURRENCY, maxPages - pageStart + 1) },
        (_, index) => pageStart + index
      );
      const pageResults = await runWithConcurrency(pageNumbers, SEARCH_CONCURRENCY, async (pageNumber) => {
        const html = await fetchHtml(buildSearchUrl(input, pageNumber), options.signal);
        const categoryLabel = input.category
          ? parseGreenFundingCategories(html).find((item) => item.value === input.category)?.label || ''
          : '';
        const parsed = parseGreenFundingListing({
          source: 'green_funding',
          kind: 'listing',
          url: buildSearchUrl(input, pageNumber),
          html
        });
        return {
          hasNext: hasNextGreenFundingListingPage(html),
          items: parsed.value.filter((item) => item.statusText !== '終了').map((item) => ({
            title: item.title,
            url: item.url,
            summary: item.summary,
            amount: parseMetricNumber(item.amountText),
            supporterCount: parseMetricNumber(item.supporterCountText),
            daysLeft: parseGreenFundingDaysLeft(item.daysLeftText),
            profileProjectCount: null,
            category: categoryLabel || null
          }))
        };
      });

      const observed = uniqueBy(pageResults.flatMap((result) => result.items), (item) => normalizeUrlForUnique(item.url));
      sourceCandidateCount += observed.length;
      const matches = sortAndFilter(observed, input);
      conditionMatchedCount += matches.length;
      for (const item of matches) {
        const key = normalizeUrlForUnique(item.url);
        if (excluded.has(key)) {
          excludedCount += 1;
          continue;
        }
        accepted.set(key, item);
      }

      const currentItems = sortAndFilter([...accepted.values()], input).slice(0, limit);
      const shouldContinue = await options.onItems?.(currentItems);
      if (shouldContinue === false) throw new OperationAbortedError();
      if (currentItems.length >= limit) {
        return {
          items: currentItems,
          diagnostics: { sourceCandidateCount, conditionMatchedCount, excludedCount, scanComplete: false }
        };
      }
      if (pageResults.some((result) => !result.hasNext)) {
        scanComplete = true;
        break;
      }
    }

    return {
      items: sortAndFilter([...accepted.values()], input).slice(0, limit),
      diagnostics: { sourceCandidateCount, conditionMatchedCount, excludedCount, scanComplete }
    };
  }

  async import(url: string): Promise<NormalizedImportedProject> {
    const normalizedUrl = this.normalizeUrl(url);
    const html = await fetchHtml(normalizedUrl);
    const detail = parseGreenFundingDetail({
      source: 'green_funding',
      kind: 'detail',
      url: normalizedUrl,
      html
    }).value;
    if (!detail.title) throw new BadRequestException('GREEN FUNDINGのプロジェクト名を取得できませんでした。');

    const amount = parseMetricNumber(detail.amountText);
    const supporterCount = parseMetricNumber(detail.supporterCountText);
    const daysLeft = parseGreenFundingDaysLeft(detail.daysLeftText);
    const isEnded = detail.statusText === '終了';
    const externalUrls = uniqueBy(detail.externalUrls, normalizeUrlForUnique);
    const instagramUrl = externalUrls.find((value) => /instagram\.com/i.test(value));
    const tiktokUrl = externalUrls.find((value) => /tiktok\.com/i.test(value));
    const xUrl = externalUrls.find((value) => /(?:twitter|x)\.com/i.test(value));

    return {
      source: this.source,
      platform: {
        type: this.source,
        name: this.name,
        baseUrl: this.baseUrl
      },
      company: {
        name: detail.executorName || 'GREEN FUNDING起案者名未取得',
        websiteUrl: detail.websiteUrl || undefined,
        inquiryUrl: detail.inquiryUrl || undefined,
        memo: buildCompanyMemo(detail.executorName, detail.websiteUrl, detail.inquiryUrl)
      },
      project: {
        title: detail.title,
        url: normalizedUrl,
        status: isEnded ? 'ended' : 'active',
        amount,
        supporterCount,
        daysLeft,
        description: detail.description || undefined,
        category: detail.category || undefined,
        thumbnailUrl: detail.thumbnailUrl || undefined,
        scrapedAt: new Date()
      },
      lead: {
        source: 'green_funding_import',
        reason: buildImportReason(amount, supporterCount, daysLeft, detail.category),
        brandWebsiteUrl: detail.websiteUrl || undefined,
        contactFormUrl: detail.inquiryUrl || undefined,
        instagramUrl,
        tiktokUrl,
        xUrl,
        contactMemo: externalUrls.length
          ? `GREEN FUNDINGページから自動取得したURL: ${externalUrls.slice(0, 8).join(' / ')}`
          : undefined,
        brandAnalysisMemo: detail.executorName
          ? `GREEN FUNDING起案者: ${detail.executorName}`
          : undefined
      },
      raw: {
        ...detail,
        amount,
        supporterCount,
        daysLeft
      }
    };
  }

  normalizeUrl(value: string) {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new BadRequestException('GREEN FUNDINGのURL形式が正しくありません。');
    }
    const projectPath = url.pathname.match(/^\/([^/]+)\/projects\/(\d+)(?:\/|$)/);
    if (!['greenfunding.jp', 'www.greenfunding.jp'].includes(url.hostname) || !projectPath) {
      throw new BadRequestException('GREEN FUNDINGのプロジェクトURLを入力してください。');
    }
    url.protocol = 'https:';
    url.hostname = 'greenfunding.jp';
    url.search = '';
    url.hash = '';
    url.pathname = `/${projectPath[1]}/projects/${projectPath[2]}`;
    return url.toString();
  }
}

function buildSearchUrl(input: ProjectSearchCriteria, page: number) {
  const url = new URL('/portals/search', GREEN_FUNDING_ORIGIN);
  const keyword = clean(input.keyword);
  if (!keyword && !input.category) url.searchParams.set('condition', 'new');
  if (keyword) url.searchParams.set('q[title_or_planner_name_cont]', keyword);
  if (input.category) url.searchParams.set('category_id', input.category);
  if (page > 1) url.searchParams.set('page', String(page));
  return url.toString();
}

async function fetchHtml(url: string, signal?: AbortSignal) {
  throwIfAborted(signal);
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), 30000);
  const abort = () => timeoutController.abort();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(url, {
        signal: timeoutController.signal,
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml'
        }
      });
      if (response.ok) return await response.text();
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) continue;
      throw new BadRequestException(`GREEN FUNDINGの取得に失敗しました（HTTP ${response.status}）。`);
    }
    throw new BadRequestException('GREEN FUNDINGの取得に失敗しました。');
  } catch (error) {
    if (signal?.aborted) throw new OperationAbortedError();
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException('GREEN FUNDINGの取得に失敗しました。時間をおいて再度お試しください。');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

function sortAndFilter(items: GreenFundingSearchItem[], input: ProjectSearchCriteria) {
  const endingSoonDays = normalizeEndingSoonDays(input.endingSoonDays);
  const filtered = items.filter((item) => {
    if (typeof item.daysLeft === 'number' && item.daysLeft < 0) return false;
    if (typeof input.amountMin === 'number' && Number(item.amount) < input.amountMin) return false;
    if (typeof input.amountMax === 'number' && Number(item.amount) > input.amountMax) return false;
    if (typeof input.supporterMin === 'number' && Number(item.supporterCount) < input.supporterMin) return false;
    if (typeof input.supporterMax === 'number' && Number(item.supporterCount) > input.supporterMax) return false;
    if (
      input.status === 'endingSoon'
      && (item.daysLeft === null || item.daysLeft === undefined || item.daysLeft > endingSoonDays)
    ) return false;
    return true;
  });
  if (input.status !== 'endingSoon') return filtered;
  return [...filtered].sort((a, b) => Number(a.daysLeft) - Number(b.daysLeft));
}

function normalizeEndingSoonDays(value?: number) {
  const number = Number(value);
  return [7, 14, 20, 30].includes(number) ? number : 14;
}

function normalizeLimit(value?: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 10;
  return Math.max(10, Math.min(200, Math.floor(number)));
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new OperationAbortedError();
}

function buildImportReason(amount: number, supporterCount: number, daysLeft: number | null, category: string) {
  return [
    amount ? `支援総額: ${amount.toLocaleString()}円` : '',
    supporterCount ? `支援人数: ${supporterCount.toLocaleString()}人` : '',
    daysLeft !== null ? `残り日数: ${daysLeft}日` : '',
    category ? `カテゴリ: ${category}` : ''
  ].filter(Boolean).join(' / ') || 'GREEN FUNDING import';
}

function buildCompanyMemo(executorName: string, websiteUrl: string, inquiryUrl: string) {
  return [
    executorName ? `GREEN FUNDING起案者: ${executorName}` : '',
    websiteUrl ? `公式サイト: ${websiteUrl}` : '',
    inquiryUrl ? `起案者問い合わせ: ${inquiryUrl}` : ''
  ].filter(Boolean).join('\n') || undefined;
}
