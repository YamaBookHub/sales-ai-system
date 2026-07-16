import {
  decideProjectSearchCompletion,
  projectSearchCompletionMessage
} from './project-search-completion';

describe('project search completion policy', () => {
  const completeDiagnostics = {
    sourceCandidateCount: 10,
    conditionMatchedCount: 10,
    excludedCount: 0,
    scanComplete: true
  };

  it.each([
    ['desired_reached', 10, {}, completeDiagnostics],
    ['source_exhausted', 8, {}, { ...completeDiagnostics, sourceCandidateCount: 8, conditionMatchedCount: 8 }],
    ['condition_shortage', 8, { status: 'endingSoon' }, { ...completeDiagnostics, conditionMatchedCount: 8 }],
    ['excluded_existing', 8, {}, { ...completeDiagnostics, conditionMatchedCount: 10, excludedCount: 2 }],
    ['failed', 8, {}, { ...completeDiagnostics, scanComplete: false }]
  ])('returns %s from factual counters', (expected, importableCount, dto, diagnostics) => {
    expect(decideProjectSearchCompletion({ desiredLimit: 10, importableCount, dto, diagnostics })).toBe(expected);
  });

  it('does not blame exclusions unless they fully explain the shortage', () => {
    expect(
      decideProjectSearchCompletion({
        desiredLimit: 10,
        importableCount: 7,
        dto: { keyword: '食品' },
        diagnostics: { ...completeDiagnostics, conditionMatchedCount: 8, excludedCount: 1 }
      })
    ).toBe('condition_shortage');
  });

  it('builds an explicit user message for every terminal reason', () => {
    const base = { desiredLimit: 10, itemCount: 8, importableCount: 8 };
    expect(projectSearchCompletionMessage({ ...base, reason: 'desired_reached' })).toContain('指定10件');
    expect(projectSearchCompletionMessage({ ...base, reason: 'source_exhausted' })).toContain('候補が8件');
    expect(projectSearchCompletionMessage({ ...base, reason: 'condition_shortage' })).toContain('条件一致が8件');
    expect(projectSearchCompletionMessage({ ...base, reason: 'excluded_existing' })).toContain('取込済み等を除外');
    expect(projectSearchCompletionMessage({ ...base, reason: 'cancelled' })).toContain('検索を停止');
    expect(projectSearchCompletionMessage({ ...base, reason: 'failed', errorMessage: 'timeout' })).toContain('timeout');
  });
});
