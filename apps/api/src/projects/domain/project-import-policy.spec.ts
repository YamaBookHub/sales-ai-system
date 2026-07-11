import {
  buildBulkImportSummary,
  clampConcurrency,
  countImportableSearchItems,
  mergeSearchItems,
  normalizeEndingSoonDays,
  normalizeResultLimit,
  normalizeSearchUrl,
  progressiveSearchLimits,
  sortEndingSoon,
  uniqueNormalizedUrlInputs
} from './project-import-policy';

describe('project-import-policy', () => {
  it('normalizes limits and concurrency conservatively', () => {
    expect(normalizeResultLimit(undefined)).toBe(10);
    expect(normalizeResultLimit(3)).toBe(10);
    expect(normalizeResultLimit(300)).toBe(200);
    expect(clampConcurrency(10, 1, 4, 3)).toBe(4);
    expect(clampConcurrency(undefined, 1, 4, 3)).toBe(3);
  });

  it('filters and sorts ending soon projects', () => {
    const items = [
      { url: 'a', daysLeft: 20, isActive: true },
      { url: 'b', daysLeft: 2, isActive: true },
      { url: 'c', daysLeft: 7, isActive: false },
      { url: 'd', daysLeft: 5, isActive: true }
    ];

    expect(normalizeEndingSoonDays(99)).toBe(14);
    expect(sortEndingSoon(items, 14).map((item) => item.url)).toEqual(['b', 'd']);
  });

  it('uses normalized URLs for merge and importable count', () => {
    const current = [{ url: 'https://example.com/project?a=1' }];
    const next = [{ url: 'https://example.com/project#top' }, { url: 'https://example.com/other' }];
    const merged = mergeSearchItems(current, next);

    expect(merged).toHaveLength(2);
    expect(countImportableSearchItems(merged, new Set([normalizeSearchUrl('https://example.com/project')]))).toBe(1);
  });

  it('deduplicates bulk import URLs after provider normalization', () => {
    const items = uniqueNormalizedUrlInputs(
      [' https://example.com/a?x=1 ', 'https://example.com/a?x=2', ''],
      (value) => value.trim().split('?')[0]
    );

    expect(items).toEqual([{ originalUrl: 'https://example.com/a?x=2', url: 'https://example.com/a' }]);
  });

  it('progressively expands search limits from the desired limit', () => {
    expect(progressiveSearchLimits(10)).toEqual([10, 50, 100, 150, 200]);
    expect(progressiveSearchLimits(120)).toEqual([150, 200]);
  });

  it('summarizes bulk import and analysis results once', () => {
    const summary = buildBulkImportSummary({
      source: 'campfire',
      total: 3,
      items: [
        { originalUrl: 'a', url: 'a', status: 'imported', leadId: 'lead-1' },
        { originalUrl: 'b', url: 'b', status: 'failed', message: 'error' }
      ],
      analysisItems: [
        { leadId: 'lead-1', status: 'analyzed' },
        { leadId: 'lead-2', status: 'failed', message: 'error' }
      ]
    });

    expect(summary).toMatchObject({
      source: 'campfire',
      total: 3,
      imported: 1,
      failed: 1,
      analyzed: 1,
      analysisFailed: 1
    });
  });
});
