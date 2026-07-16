import * as cheerio from 'cheerio';
import { ProjectParserResult, RawProjectPageSnapshot } from '../parser.types';
import { CampfireListingItem } from './campfire.types';

const CAMPFIRE_ORIGIN = 'https://camp-fire.jp';

export const CAMPFIRE_LISTING_SELECTORS = {
  cards: 'listing.cards.primary',
  cardsFallback: 'listing.cards.fallback.project-card',
  cardsGenericFallback: 'listing.cards.fallback.project-link-container',
  link: 'listing.link.primary',
  linkFallback: 'listing.link.fallback.project-link',
  title: 'listing.title.primary',
  titleFallback: 'listing.title.fallback.heading',
  amount: 'listing.amount.primary',
  amountFallback: 'listing.amount.fallback.label',
  supporters: 'listing.supporters.primary',
  supportersFallback: 'listing.supporters.fallback.label',
  daysLeft: 'listing.daysLeft.primary',
  daysLeftFallback: 'listing.daysLeft.fallback.label',
  category: 'listing.category.primary',
  categoryFallback: 'listing.category.fallback.label',
  publicStatus: 'listing.publicStatus.primary',
  publicStatusFallback: 'listing.publicStatus.fallback.label'
} as const;

export function parseCampfireListing(snapshot: RawProjectPageSnapshot): ProjectParserResult<CampfireListingItem[]> {
  assertSnapshot(snapshot, 'listing');
  const $ = cheerio.load(snapshot.html);
  const fallbacksUsed: string[] = [];
  const cardElements = $('[data-project-card]').toArray();
  const fallbackCardElements = cardElements.length ? [] : $('.project-card, article[data-card="project"]').toArray();
  const cards = cardElements.length
    ? cardElements
    : fallbackCardElements.length
      ? fallbackCardElements.map((element) => {
          fallbacksUsed.push(CAMPFIRE_LISTING_SELECTORS.cardsFallback);
          return element;
        })
      : genericProjectCardElements($).map((element) => {
          fallbacksUsed.push(CAMPFIRE_LISTING_SELECTORS.cardsGenericFallback);
          return element;
        });

  const items = cards
    .map((element) => {
      const card = $(element);
      const cardText = clean(card.text());
      const projectLink = firstIncludingSelf(card, 'a[href*="/projects/"][href*="/view"]');
      const link = firstTextOrAttrIncludingSelf(card, '[data-project-link]', 'href');
      const fallbackLink = link || clean(projectLink.attr('href'));
      if (!link && fallbackLink) fallbacksUsed.push(CAMPFIRE_LISTING_SELECTORS.linkFallback);

      const title = firstText(card, '[data-project-title]');
      const fallbackTitle = title || firstText(card, 'h2, h3') || clean(projectLink.attr('title')) || clean(projectLink.text());
      if (!title && fallbackTitle) fallbacksUsed.push(CAMPFIRE_LISTING_SELECTORS.titleFallback);

      const amountValue = firstText(card, '[data-project-amount]');
      const amountText = amountValue || findFirst(cardText, [/支援総額\s*[:：]?\s*([0-9,]+円?)/g, /現在\s*([0-9,]+円?)/g]);
      if (!amountValue && amountText) fallbacksUsed.push(CAMPFIRE_LISTING_SELECTORS.amountFallback);

      const supportersValue = firstText(card, '[data-project-supporters]');
      const supportersText = supportersValue || findFirst(cardText, [/支援者(?:数)?\s*[:：]?\s*([0-9,]+人?)/g]);
      if (!supportersValue && supportersText) fallbacksUsed.push(CAMPFIRE_LISTING_SELECTORS.supportersFallback);

      const daysValue = firstText(card, '[data-project-days]');
      const daysText = daysValue || findFirst(cardText, [/残り\s*([0-9]+\s*日)/g, /あと\s*([0-9]+\s*日)/g]);
      if (!daysValue && daysText) fallbacksUsed.push(CAMPFIRE_LISTING_SELECTORS.daysLeftFallback);

      const categoryValue = firstText(card, '[data-project-category]');
      const categoryText = categoryValue || findFirst(cardText, [/(?:カテゴリー|カテゴリ)\s*[:：]?\s*(.*?)(?=\s*(?:公開状態|ステータス|状態)\s*[:：]?|$)/g]);
      if (!categoryValue && categoryText) fallbacksUsed.push(CAMPFIRE_LISTING_SELECTORS.categoryFallback);

      const statusValue = firstText(card, '[data-project-status]');
      const statusText = statusValue || findFirst(cardText, [/(?:公開状態|ステータス|状態)\s*[:：]?\s*([^|｜\n]+)/g]) || findStatus(cardText);
      if (!statusValue && statusText) fallbacksUsed.push(CAMPFIRE_LISTING_SELECTORS.publicStatusFallback);

      const profileProjectCount = findFirst(cardText, [
        /他に\s*([0-9,]+\s*件)のプロジェクト/g,
        /過去(?:の)?プロジェクト\s*([0-9,]+\s*件)/g
      ]) || null;

      return {
        projectUrl: absolutize(fallbackLink, CAMPFIRE_ORIGIN),
        projectTitle: clean(extractValue(fallbackTitle)),
        supportAmount: clean(extractValue(amountText)),
        supporters: clean(extractValue(supportersText)),
        daysLeft: clean(extractValue(daysText)) || null,
        category: clean(categoryText),
        publicStatus: clean(statusText),
        profileProjectCount: clean(profileProjectCount) || null,
        summary: cardText.slice(0, 180)
      };
    })
    .filter((item) => item.projectUrl && item.projectTitle);

  return { value: uniqueBy(items, (item) => normalizeUrl(item.projectUrl)), fallbacksUsed: unique(fallbacksUsed) };
}

function assertSnapshot(snapshot: RawProjectPageSnapshot, kind: 'listing') {
  if (snapshot.source !== 'campfire' || snapshot.kind !== kind) {
    throw new Error(`CAMPFIRE listing parser requires a ${kind} snapshot.`);
  }
}

function firstText($: cheerio.Cheerio<any>, selector: string) {
  return clean($.find(selector).first().text());
}

function firstTextOrAttrIncludingSelf($: cheerio.Cheerio<any>, selector: string, attribute: string) {
  return clean(firstIncludingSelf($, selector).attr(attribute));
}

function firstIncludingSelf($: cheerio.Cheerio<any>, selector: string) {
  return $.is(selector) ? $.first() : $.find(selector).first();
}

function genericProjectCardElements($: cheerio.CheerioAPI) {
  const seen = new Set<any>();
  return $('a[href*="/projects/"][href*="/view"]')
    .toArray()
    .map((anchor) => $(anchor).closest('article, li, div').get(0) || anchor)
    .filter((element) => {
      if (seen.has(element)) return false;
      seen.add(element);
      return true;
    });
}

function extractValue(value: string) {
  return value
    .replace(/^\s*(?:支援総額|支援者(?:数)?|現在|残り|あと)\s*[:：]?\s*/u, '')
    .replace(/\s*(?:支援者|集まっています|集まっております|募集中|終了|もうすぐ公開)\s*$/u, '')
    .trim();
}

function findStatus(text: string) {
  return text.match(/募集中|募集終了|受付終了|終了しました|終了|もうすぐ公開|近日公開|公開予定|COMING\s*SOON/i)?.[0] || '';
}

function findFirst(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = new RegExp(pattern.source, pattern.flags.replace('g', '')).exec(text);
    if (match?.[1]) return clean(match[1]);
  }
  return '';
}

function clean(value: string | undefined | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function absolutize(href: string, origin: string) {
  if (!href) return '';
  try {
    return new URL(href, origin).toString();
  } catch {
    return '';
  }
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return value;
  }
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
