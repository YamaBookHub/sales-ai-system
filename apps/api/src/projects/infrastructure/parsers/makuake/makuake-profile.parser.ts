import * as cheerio from 'cheerio';
import { ProjectParserResult, RawProjectPageSnapshot } from '../parser.types';
import { MakuakeProfile } from './makuake-parser.types';
import {
  clean,
  extractAmountText,
  extractMemberDescription,
  extractSupporterCountText,
  extractNumberAfterLabels
} from './makuake-parser.utils';

const NAME_SELECTOR = '[data-testid="member-name"]';
const TOTAL_AMOUNT_SELECTOR = '[data-testid="member-total-amount"]';
const PROJECT_COUNT_SELECTOR = '[data-testid="member-project-count"]';
const SUPPORTERS_SELECTOR = '[data-testid="member-supporters"]';

export function parseMakuakeProfile(snapshot: RawProjectPageSnapshot): ProjectParserResult<MakuakeProfile> {
  const $ = cheerio.load(snapshot.html);
  const fallbacksUsed: string[] = [];
  const pageText = snapshot.visibleText ? clean(snapshot.visibleText) : clean($('body').text());
  const textSource = snapshot.visibleText ? 'visibleText' : 'bodyText';

  const name = selectOrFallback(
    $,
    NAME_SELECTOR,
    () => clean($('h1,h2,[class*="name"],[class*="Name"]').first().text()),
    'profile.name.selector',
    fallbacksUsed
  );
  const totalAmountText = metricOrFallback(
    $,
    TOTAL_AMOUNT_SELECTOR,
    pageText,
    extractAmountText,
    'totalAmount',
    textSource,
    fallbacksUsed
  );
  const projectCountText = metricOrFallback(
    $,
    PROJECT_COUNT_SELECTOR,
    pageText,
    (value) => extractNumberAfterLabels(value, ['プロジェクト数'], ['件'], 80)?.[0] || value.match(/[0-9,]+\s*件?/)?.[0] || null,
    'projectCount',
    textSource,
    fallbacksUsed
  );
  const supporterCountText = metricOrFallback(
    $,
    SUPPORTERS_SELECTOR,
    pageText,
    extractSupporterCountText,
    'supporters',
    textSource,
    fallbacksUsed
  );

  return {
    value: {
      url: snapshot.url,
      name,
      totalAmountText,
      projectCountText,
      supporterCountText,
      description: extractMemberDescription($, pageText)
    },
    fallbacksUsed
  };
}

function selectOrFallback(
  $: cheerio.CheerioAPI,
  selector: string,
  fallback: () => string,
  fallbackName: string,
  fallbacksUsed: string[]
) {
  const primaryValue = clean($(selector).first().text());
  if (primaryValue) return primaryValue;
  const fallbackValue = fallback();
  if (fallbackValue) fallbacksUsed.push(fallbackName);
  return fallbackValue;
}

function metricOrFallback(
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
  if (fallbackValue) fallbacksUsed.push(`profile.${name}.${textSource}`);
  return fallbackValue;
}
