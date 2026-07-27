import * as cheerio from 'cheerio';
import { ProjectParserResult, RawProjectPageSnapshot } from '../parser.types';
import { GreenFundingListingItem } from './green-funding-parser.types';
import { absolutize, clean, isGreenFundingProjectUrl, normalizeUrlForUnique, uniqueBy } from './green-funding-parser.utils';

const CARD_SELECTOR = '.m-projects__card';

export function parseGreenFundingListing(
  snapshot: RawProjectPageSnapshot
): ProjectParserResult<GreenFundingListingItem[]> {
  const $ = cheerio.load(snapshot.html);
  const items = $(CARD_SELECTOR)
    .toArray()
    .map((element) => {
      const card = $(element);
      const link = card.find('a[href*="/projects/"]').first();
      const metrics = card.find('.m-projects__card__information-status-number');
      const amountText = clean(card.find('.m-projects__card__information-amount').first().text()) || null;
      const supporterCountText = clean(metrics.eq(0).text()) || null;
      const daysLeftText = clean(metrics.eq(1).text()) || null;
      const statusText = /終了|募集終了/.test(daysLeftText || clean(card.text()))
        ? '終了'
        : /[0-9][0-9,]*\s*(?:日|時間|分)/.test(daysLeftText || '')
          ? '募集中'
          : '';
      return {
        title: clean(card.find('.m-projects__card__about-title').first().text()),
        url: absolutize(link.attr('href') || ''),
        summary: clean(card.find('.m-projects__card__about-description').first().text()),
        amountText,
        supporterCountText,
        daysLeftText,
        statusText,
        category: '',
        thumbnailUrl: absolutize(card.find('.m-projects__card__image img').first().attr('src') || '')
      };
    })
    .filter((item) => item.title && isGreenFundingProjectUrl(item.url));

  return {
    value: uniqueBy(items, (item) => normalizeUrlForUnique(item.url)),
    fallbacksUsed: []
  };
}

export function parseGreenFundingCategories(html: string) {
  const $ = cheerio.load(html);
  return uniqueBy(
    $('.v-layouts-header__accordion-navigation__category-list a[href*="category_id="]')
      .toArray()
      .map((element) => {
        const link = $(element);
        const href = link.attr('href') || '';
        const value = new URL(absolutize(href)).searchParams.get('category_id') || '';
        return {
          label: clean(link.find('.category_icon_wrapper-category-name').text() || link.text()),
          value
        };
      })
      .filter((item) => item.label && item.value),
    (item) => item.value
  );
}

export function hasNextGreenFundingListingPage(html: string) {
  const $ = cheerio.load(html);
  return $('a[rel="next"]').length > 0;
}
