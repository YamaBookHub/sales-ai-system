import * as cheerio from 'cheerio';
import { ProjectParserResult, RawProjectPageSnapshot } from '../parser.types';
import { MakuakeListingItem } from './makuake-parser.types';
import {
  absolutize,
  clean,
  extractAmountText,
  extractCategory,
  extractDaysLeftText,
  extractLocation,
  extractSupporterCountText,
  firstUsefulLine,
  uniqueBy,
  normalizeUrlForUnique
} from './makuake-parser.utils';

const CARD_SELECTOR = '[data-testid="project-card"]';
const AMOUNT_SELECTOR = '[data-testid="project-amount"]';
const SUPPORTERS_SELECTOR = '[data-testid="project-supporters"]';
const DAYS_SELECTOR = '[data-testid="project-days-left"]';
const STATUS_SELECTOR = '[data-testid="project-status"]';
const CATEGORY_SELECTOR = '[data-testid="project-category"]';
const LOCATION_SELECTOR = '[data-testid="project-location"]';

export function parseMakuakeListing(snapshot: RawProjectPageSnapshot): ProjectParserResult<MakuakeListingItem[]> {
  const $ = cheerio.load(snapshot.html);
  const fallbacksUsed = new Set<string>();
  const items = $('a[href*="/project/"]')
    .toArray()
    .map((element) => {
      const link = $(element);
      const card = link.closest(CARD_SELECTOR).length ? link.closest(CARD_SELECTOR) : link.closest('article, li, div');
      if (!card.length) fallbacksUsed.add('listing.card.anchorText');
      const sourceText = clean(card.text()) || clean(link.text());
      const url = absolutize(link.attr('href') || '');
      const amountText = extractMetric(card, AMOUNT_SELECTOR, sourceText, extractAmountText, 'amount', fallbacksUsed);
      const supporterCountText = extractMetric(card, SUPPORTERS_SELECTOR, sourceText, extractSupporterCountText, 'supporters', fallbacksUsed);
      const daysLeftText = extractMetric(card, DAYS_SELECTOR, sourceText, extractDaysLeftText, 'daysLeft', fallbacksUsed);
      const category = extractLabel(card, CATEGORY_SELECTOR, sourceText, extractCategory, 'category', fallbacksUsed);
      const location = extractLabel(card, LOCATION_SELECTOR, sourceText, extractLocation, 'location', fallbacksUsed);
      const statusText = extractLabel(card, STATUS_SELECTOR, sourceText, (value) => clean(value.match(/販売中|募集中|終了|販売終了|募集終了/)?.[0] || ''), 'status', fallbacksUsed);
      const title = clean(link.attr('title') || card.find('h1,h2,h3,[class*="title"]').first().text() || link.text());

      return {
        title: title || firstUsefulLine(sourceText) || '案件名なし',
        url,
        summary: sourceText.slice(0, 180),
        amountText,
        supporterCountText,
        daysLeftText,
        category,
        location,
        statusText
      };
    })
    .filter((item) => item.url && item.title && isProjectUrl(item.url));

  return { value: uniqueBy(items, (item) => normalizeUrlForUnique(item.url)), fallbacksUsed: [...fallbacksUsed] };
}

export function isActiveMakuakeListing(item: MakuakeListingItem) {
  const status = clean(item.statusText || item.summary);
  if (/終了|募集終了|販売終了/.test(status)) return false;
  return item.daysLeftText !== null || /販売中|募集中/.test(status);
}

function extractMetric(
  card: cheerio.Cheerio<any>,
  selector: string,
  sourceText: string,
  fallback: (value: string) => string | null,
  name: string,
  fallbacksUsed: Set<string>
) {
  const primaryText = clean(card.filter(selector).text() || card.find(selector).first().text());
  if (primaryText) return fallback(primaryText);
  const fallbackValue = fallback(sourceText);
  if (fallbackValue) fallbacksUsed.add(`listing.${name}.cardText`);
  return fallbackValue;
}

function extractLabel(
  card: cheerio.Cheerio<any>,
  selector: string,
  sourceText: string,
  fallback: (value: string) => string,
  name: string,
  fallbacksUsed: Set<string>
) {
  const primaryText = clean(card.filter(selector).text() || card.find(selector).first().text());
  if (primaryText) return fallback(primaryText);
  const fallbackValue = fallback(sourceText);
  if (fallbackValue) fallbacksUsed.add(`listing.${name}.cardText`);
  return fallbackValue;
}

function isProjectUrl(url: string) {
  return /makuake\.com\/project\/[^/?#]+/i.test(url);
}
