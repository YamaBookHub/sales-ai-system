import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RawProjectPageSnapshot } from '../parser.types';
import { CAMPFIRE_DETAIL_SELECTORS, parseCampfireDetail } from './campfire-detail.parser';
import { CAMPFIRE_LISTING_SELECTORS, parseCampfireListing } from './campfire-listing.parser';
import { mapCampfireListingItem } from './campfire-listing.mapper';
import { CAMPFIRE_PROFILE_SELECTORS, parseCampfireProfile } from './campfire-profile.parser';
import { mapCampfireProfileProjectCount, matchesCampfireProfileProjectRange } from './campfire-profile.mapper';

const fixture = (name: string) => join(__dirname, '__fixtures__', name);
const snapshot = (kind: RawProjectPageSnapshot['kind'], name: string, visibleText?: string): RawProjectPageSnapshot => ({
  source: 'campfire',
  kind,
  url: `https://camp-fire.jp/projects/${name.replace(/\D/g, '') || '1001'}/view`,
  html: readFileSync(fixture(name), 'utf8'),
  visibleText
});

describe('CAMPFIRE fixture parsers', () => {
  it('extracts active, ended, and upcoming listing states without joining unrelated numbers', () => {
    const result = parseCampfireListing(snapshot('listing', 'listing-active.html'));

    expect(result.value).toEqual([
      expect.objectContaining({
        projectTitle: '発酵ドリンクを届ける小さな工房',
        supportAmount: '1,234,500円',
        supporters: '123人',
        daysLeft: '8日',
        category: 'フード・飲食店',
        publicStatus: '募集中'
      }),
      expect.objectContaining({ projectTitle: '終了した木工プロジェクト', daysLeft: null, publicStatus: '終了' }),
      expect.objectContaining({ projectTitle: 'もうすぐ公開される写真集', daysLeft: null, publicStatus: 'もうすぐ公開' })
    ]);

    expect(result.value.map(mapCampfireListingItem).map((item) => ({ title: item.title, isActive: item.isActive }))).toEqual([
      { title: '発酵ドリンクを届ける小さな工房', isActive: true },
      { title: '終了した木工プロジェクト', isActive: false },
      { title: 'もうすぐ公開される写真集', isActive: false }
    ]);
  });

  it('records the ordered selector fallback path for a legacy listing card', () => {
    const result = parseCampfireListing(snapshot('listing', 'listing-fallback.html'));

    expect(result.value[0]).toEqual(expect.objectContaining({
      projectTitle: '山の香りを閉じ込めた石けん',
      supportAmount: '98,700円',
      supporters: '45人',
      daysLeft: '12日',
      category: 'ビューティー・ヘルスケア',
      publicStatus: '募集中'
    }));
    expect(result.fallbacksUsed).toEqual([
      CAMPFIRE_LISTING_SELECTORS.cardsFallback,
      CAMPFIRE_LISTING_SELECTORS.linkFallback,
      CAMPFIRE_LISTING_SELECTORS.titleFallback,
      CAMPFIRE_LISTING_SELECTORS.amountFallback,
      CAMPFIRE_LISTING_SELECTORS.supportersFallback,
      CAMPFIRE_LISTING_SELECTORS.daysLeftFallback,
      CAMPFIRE_LISTING_SELECTORS.categoryFallback,
      CAMPFIRE_LISTING_SELECTORS.publicStatusFallback
    ]);
  });

  it('finds real-world generic project links when card-specific selectors are absent', () => {
    const result = parseCampfireListing(snapshot('listing', 'listing-generic-link.html'));

    expect(result.value).toEqual([
      expect.objectContaining({
        projectUrl: 'https://camp-fire.jp/projects/9001/view',
        projectTitle: '地域の小さな映画館を守りたい',
        supportAmount: '2,345,600円',
        supporters: '234人',
        daysLeft: '9日',
        category: '映画・映像',
        publicStatus: '募集中'
      })
    ]);
    expect(result.fallbacksUsed).toContain(CAMPFIRE_LISTING_SELECTORS.cardsGenericFallback);
    expect(result.fallbacksUsed).toContain(CAMPFIRE_LISTING_SELECTORS.linkFallback);
  });

  it('extracts detail fields while leaving profile project count to the profile parser', () => {
    const result = parseCampfireDetail(snapshot('detail', 'detail-active.html'));

    expect(result.value).toEqual(expect.objectContaining({
      projectTitle: '発酵ドリンクを届ける小さな工房',
      executorName: '工房の実行者',
      brandName: '山の発酵室',
      supportAmount: '1,234,500円',
      supporters: '123人',
      daysLeft: '8日',
      category: 'フード・飲食店',
      publicStatus: '募集中',
      profileUrl: 'https://camp-fire.jp/profile/clean-maker/projects',
      websiteUrl: 'https://example.test/brand',
      inquiryUrl: 'https://example.test/contact',
      instagramUrl: 'https://instagram.com/example'
    }));
    expect(result.value).not.toHaveProperty('profileProjectCount');
    expect(result.fallbacksUsed).toEqual([]);
  });

  it('extracts the first-project and 100-plus profile cases', () => {
    const first = parseCampfireProfile(snapshot('profile', 'profile-first-project.html'));
    const large = parseCampfireProfile(snapshot('profile', 'profile-100-plus.html'));

    expect(first.value).toEqual({ executorName: 'はじめての工房', projectCount: '0件' });
    expect(first.fallbacksUsed).toContain(CAMPFIRE_PROFILE_SELECTORS.projectCountFirst);
    expect(large.value).toEqual({ executorName: '長く活動するメーカー', projectCount: '過去のプロジェクト 128件' });
    expect(large.fallbacksUsed).toEqual([]);
    expect(mapCampfireProfileProjectCount(first.value.projectCount)).toBe(0);
    expect(mapCampfireProfileProjectCount(large.value.projectCount)).toBe(128);
    expect(matchesCampfireProfileProjectRange(mapCampfireProfileProjectCount(large.value.projectCount), 100)).toBe(true);
    expect(matchesCampfireProfileProjectRange(mapCampfireProfileProjectCount(first.value.projectCount), 1)).toBe(false);
  });

  it('uses visible text only as the final profile fallback', () => {
    const result = parseCampfireProfile({
      source: 'campfire',
      kind: 'profile',
      url: 'https://camp-fire.jp/profile/visible-only',
      html: '<html><body><h1>表示だけの実行者</h1></body></html>',
      visibleText: '表示だけの実行者 過去のプロジェクト 101件'
    });

    expect(result.value.projectCount).toBe('101件');
    expect(result.fallbacksUsed).toContain(CAMPFIRE_PROFILE_SELECTORS.projectCountVisibleText);
  });

  it('keeps fallback selector names provider-specific', () => {
    expect(CAMPFIRE_DETAIL_SELECTORS.publicStatusFallback).toBe('detail.publicStatus.fallback.label');
  });
});
