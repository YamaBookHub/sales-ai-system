import * as cheerio from 'cheerio';
import { ProjectParserResult, RawProjectPageSnapshot } from '../parser.types';
import { MakuakeDetail } from './makuake-parser.types';
import {
  clean,
  extractAmountText,
  extractCategory,
  extractDaysLeftText,
  extractExecutorName,
  extractExternalUrls,
  extractLocation,
  extractMemberUrl,
  extractSupporterCountText
} from './makuake-parser.utils';

const AMOUNT_SELECTOR = '[data-testid="project-amount"]';
const SUPPORTERS_SELECTOR = '[data-testid="project-supporters"]';
const DAYS_SELECTOR = '[data-testid="project-days-left"]';
const STATUS_SELECTOR = '[data-testid="project-status"]';
const CATEGORY_SELECTOR = '[data-testid="project-category"]';
const LOCATION_SELECTOR = '[data-testid="project-location"]';
const EXECUTOR_SELECTOR = '[data-testid="project-executor"]';

export function parseMakuakeDetail(snapshot: RawProjectPageSnapshot): ProjectParserResult<MakuakeDetail> {
  const $ = cheerio.load(snapshot.html);
  const fallbacksUsed: string[] = [];
  const pageText = snapshot.visibleText ? clean(snapshot.visibleText) : clean($('body').text());
  const textSource = snapshot.visibleText ? 'visibleText' : 'bodyText';

  const amountText = extractMetric($, AMOUNT_SELECTOR, pageText, extractAmountText, 'amount', textSource, fallbacksUsed);
  const supporterCountText = extractMetric($, SUPPORTERS_SELECTOR, pageText, extractSupporterCountText, 'supporters', textSource, fallbacksUsed);
  const daysLeftText = extractMetric($, DAYS_SELECTOR, pageText, extractDaysLeftText, 'daysLeft', textSource, fallbacksUsed);
  const category = extractLabel($, CATEGORY_SELECTOR, pageText, extractCategory, 'category', textSource, fallbacksUsed);
  const location = extractLabel($, LOCATION_SELECTOR, pageText, extractLocation, 'location', textSource, fallbacksUsed);
  const executorName = extractExecutor($, pageText, textSource, fallbacksUsed);
  const statusText = extractStatus($, pageText, textSource, fallbacksUsed);
  const title = clean($('meta[property="og:title"]').attr('content') || $('h1').first().text() || $('title').text());
  const externalUrls = extractExternalUrls($, snapshot.url);
  const memberUrl = extractMemberUrl($, snapshot.url);

  return {
    value: {
      title,
      url: snapshot.url,
      executorName,
      amountText,
      supporterCountText,
      daysLeftText,
      statusText,
      description: clean($('meta[property="og:description"]').attr('content') || $('[class*="description"], [class*="story"], main').first().text()).slice(0, 1600),
      category,
      location,
      thumbnailUrl: $('meta[property="og:image"]').attr('content') || '',
      websiteUrl: externalUrls.find((item) => !/makuake\.com|twitter\.com|x\.com|instagram\.com|facebook\.com|youtube\.com/.test(item)) || '',
      inquiryUrl: externalUrls.find((item) => /contact|inquiry|お問い合わせ/.test(item)) || '',
      externalUrls,
      memberUrl
    },
    fallbacksUsed
  };
}

function extractMetric(
  $: cheerio.CheerioAPI,
  selector: string,
  pageText: string,
  parser: (value: string) => string | null,
  name: string,
  textSource: string,
  fallbacksUsed: string[]
) {
  const primaryText = clean($(selector).first().text());
  const primaryValue = primaryText ? parser(primaryText) : null;
  if (primaryValue) return primaryValue;
  const fallbackValue = parser(pageText);
  if (fallbackValue) fallbacksUsed.push(`detail.${name}.${textSource}.label`);
  return fallbackValue;
}

function extractLabel(
  $: cheerio.CheerioAPI,
  selector: string,
  pageText: string,
  parser: (value: string) => string,
  name: string,
  textSource: string,
  fallbacksUsed: string[]
) {
  const primaryValue = clean($(selector).first().text());
  if (primaryValue) return parser(primaryValue);
  const fallbackValue = parser(pageText);
  if (fallbackValue) fallbacksUsed.push(`detail.${name}.${textSource}`);
  return fallbackValue;
}

function extractExecutor($: cheerio.CheerioAPI, pageText: string, textSource: string, fallbacksUsed: string[]) {
  const primaryValue = clean($(EXECUTOR_SELECTOR).first().text());
  if (primaryValue) return primaryValue;
  const fallbackValue = extractExecutorName($, pageText);
  if (fallbackValue) fallbacksUsed.push(`detail.executor.${textSource}`);
  return fallbackValue;
}

function extractStatus($: cheerio.CheerioAPI, pageText: string, textSource: string, fallbacksUsed: string[]) {
  const primaryValue = clean($(STATUS_SELECTOR).first().text());
  if (primaryValue) return primaryValue;
  const fallbackValue = pageText.match(/販売中|募集中|終了|販売終了|募集終了/)?.[0] || '';
  if (fallbackValue) fallbacksUsed.push(`detail.status.${textSource}`);
  return fallbackValue;
}
