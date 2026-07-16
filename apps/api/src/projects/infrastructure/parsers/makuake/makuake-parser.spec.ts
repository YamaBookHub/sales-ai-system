import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMakuakeDetail } from './makuake-detail.parser';
import { isActiveMakuakeListing, parseMakuakeListing } from './makuake-listing.parser';
import { parseMakuakeProfile } from './makuake-profile.parser';

const fixturePath = (name: string) => join(__dirname, '__fixtures__', name);
const fixture = (name: string) => readFileSync(fixturePath(name), 'utf8');

describe('Makuake sanitized fixture parsers', () => {
  it('keeps amount 14,515,000円 separate from supporters and remaining 8 days', () => {
    const result = parseMakuakeListing({
      source: 'makuake',
      kind: 'listing',
      url: 'https://www.makuake.com/discover',
      html: fixture('listing-current.html')
    });

    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
      amountText: '14,515,000円',
      supporterCountText: '1,234人',
      daysLeftText: '8日',
      category: 'ガジェット',
      location: '長野'
    });
    expect(result.fallbacksUsed).toEqual(expect.arrayContaining([
      'listing.amount.cardText',
      'listing.supporters.cardText',
      'listing.daysLeft.cardText'
    ]));
  });

  it('uses structured selectors for 応援購入総額, サポーター, 販売中', () => {
    const result = parseMakuakeListing({
      source: 'makuake',
      kind: 'listing',
      url: 'https://www.makuake.com/discover',
      html: fixture('listing-selling.html')
    });

    expect(result.value[0]).toMatchObject({
      amountText: '2,345,678円',
      supporterCountText: '321人',
      daysLeftText: '50日',
      statusText: '販売中',
      category: 'プロダクト',
      location: '大阪'
    });
    expect(result.fallbacksUsed).not.toEqual(expect.arrayContaining([
      'listing.amount.cardText',
      'listing.supporters.cardText',
      'listing.daysLeft.cardText'
    ]));
  });

  it('keeps a 販売中 listing even when the remaining-day label is absent', () => {
    const result = parseMakuakeListing({
      source: 'makuake',
      kind: 'listing',
      url: 'https://www.makuake.com/discover',
      html: fixture('listing-selling-no-days.html')
    });

    expect(result.value).toEqual([
      expect.objectContaining({
        title: '販売中の日用品',
        amountText: '780,000円',
        supporterCountText: '80人',
        daysLeftText: null,
        statusText: '販売中'
      })
    ]);
    expect(isActiveMakuakeListing(result.value[0])).toBe(true);
  });

  it('does not read 残り50日 as 150日 when the amount has commas', () => {
    const result = parseMakuakeDetail({
      source: 'makuake',
      kind: 'detail',
      url: 'https://www.makuake.com/project/detail-comma-amount/',
      html: fixture('detail-comma-amount.html'),
      visibleText: '¥14,515,000 50日 90% サポーター 88人 販売中 カテゴリ ガジェット 地域 長野県 実行者 山岳工房'
    });

    expect(result.value).toMatchObject({
      amountText: '¥14,515,000',
      supporterCountText: '88人',
      daysLeftText: '50日',
      category: 'ガジェット',
      location: '長野',
      executorName: '山岳工房',
      statusText: '販売中'
    });
    expect(result.fallbacksUsed).toEqual(expect.arrayContaining([
      'detail.amount.visibleText.label',
      'detail.daysLeft.visibleText.label',
      'detail.executor.visibleText'
    ]));
  });

  it('extracts a profile project count of 6 through the text fallback', () => {
    const result = parseMakuakeProfile({
      source: 'makuake',
      kind: 'profile',
      url: 'https://www.makuake.com/member/index/42/',
      html: fixture('profile-six-projects.html')
    });

    expect(result.value).toMatchObject({
      name: '山岳工房',
      totalAmountText: '30,000,000円',
      projectCountText: '6件',
      supporterCountText: '2,400人'
    });
    expect(result.fallbacksUsed).toEqual(expect.arrayContaining([
      'profile.name.selector',
      'profile.projectCount.bodyText',
      'profile.supporters.bodyText'
    ]));
  });

  it('does not import browser, page, or database dependencies', () => {
    const parserSources = [
      'makuake-listing.parser.ts',
      'makuake-detail.parser.ts',
      'makuake-profile.parser.ts',
      'makuake-parser.utils.ts'
    ].map((name) => readFileSync(join(__dirname, name), 'utf8')).join('\n');

    expect(parserSources).not.toMatch(/from ['"]playwright|from ['"][^'"]*prisma|from ['"][^'"]*database/i);
  });
});
