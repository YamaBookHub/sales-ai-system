import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGreenFundingDetail } from './green-funding-detail.parser';
import {
  hasNextGreenFundingListingPage,
  parseGreenFundingCategories,
  parseGreenFundingListing
} from './green-funding-listing.parser';
import { parseGreenFundingDaysLeft } from './green-funding-parser.utils';

const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

describe('GREEN FUNDING sanitized fixture parsers', () => {
  it('keeps amount, supporters, and remaining days separate', () => {
    const result = parseGreenFundingListing({
      source: 'green_funding',
      kind: 'listing',
      url: 'https://greenfunding.jp/portals/search?condition=new',
      html: fixture('listing-active.html')
    });

    expect(result.value).toEqual([
      expect.objectContaining({
        title: '家庭で本格ラテを楽しめるマシン',
        url: 'https://greenfunding.jp/lab/projects/9380',
        amountText: '¥41,896,477',
        supporterCountText: '680人',
        daysLeftText: '4日'
      })
    ]);
    expect(hasNextGreenFundingListingPage(fixture('listing-active.html'))).toBe(true);
  });

  it('extracts category values from the official category navigation', () => {
    expect(parseGreenFundingCategories(fixture('listing-active.html'))).toEqual([
      { label: 'ガジェット', value: '27' }
    ]);
  });

  it('maps remaining hours and minutes to zero days without changing ended values', () => {
    const result = parseGreenFundingListing({
      source: 'green_funding',
      kind: 'listing',
      url: 'https://greenfunding.jp/portals/search?condition=new',
      html: fixture('listing-subday.html')
    }).value;

    expect(result.map((item) => item.daysLeftText)).toEqual(['12時間', '45分']);
    expect(result.map((item) => parseGreenFundingDaysLeft(item.daysLeftText))).toEqual([0, 0]);
    expect(parseGreenFundingDaysLeft('12日')).toBe(12);
    expect(parseGreenFundingDaysLeft('終了')).toBeNull();
  });

  it('extracts detail metrics and executor contact information', () => {
    const result = parseGreenFundingDetail({
      source: 'green_funding',
      kind: 'detail',
      url: 'https://greenfunding.jp/lab/projects/9380',
      html: fixture('detail-active.html')
    });

    expect(result.value).toMatchObject({
      title: '家庭で本格ラテを楽しめるマシン',
      executorName: '株式会社SPACE',
      amountText: '41,896,477',
      supporterCountText: '680人',
      daysLeftText: '4日',
      statusText: '募集中',
      category: 'ライフスタイル',
      categories: ['ライフスタイル'],
      websiteUrl: 'https://space.example/',
      inquiryUrl: 'https://greenfunding.jp/lab/projects/9380/project_inquiries/faq'
    });
    expect(result.value.description).toBe('家庭用として十分な性能と手入れしやすい設計を備えています。');
    expect(result.value.description).not.toMatch(/function|document|window|project-content/);
  });

  it('keeps ended listings and details distinguishable from zero-day active projects', () => {
    const listing = parseGreenFundingListing({
      source: 'green_funding',
      kind: 'listing',
      url: 'https://greenfunding.jp/portals/search?condition=new&page=5',
      html: fixture('listing-ended.html')
    }).value[0];
    const detail = parseGreenFundingDetail({
      source: 'green_funding',
      kind: 'detail',
      url: 'https://greenfunding.jp/lab/projects/9320',
      html: fixture('detail-ended.html')
    }).value;

    expect(listing.daysLeftText).toBe('終了');
    expect(detail).toMatchObject({
      statusText: '終了',
      daysLeftText: '終了',
      supporterCountText: '192人',
      amountText: '3,770,846'
    });
  });
});
