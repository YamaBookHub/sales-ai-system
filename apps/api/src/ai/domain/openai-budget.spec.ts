import {
  assertOpenAiBudgetAvailable,
  buildOpenAiUsageSummary,
  estimateOpenAiRequestCost,
  openAiMonthRange,
  readOpenAiBudgetConfig
} from './openai-budget';

describe('openai-budget', () => {
  it('allows usage when the monthly budget is not configured', () => {
    expect(() => assertOpenAiBudgetAvailable({ budgetUsd: null, spentUsd: 100, reservedUsd: 0, estimatedCostUsd: 1 }))
      .not.toThrow();
  });

  it('allows a request inside the budget and rejects one that would exceed it', () => {
    expect(() => assertOpenAiBudgetAvailable({ budgetUsd: 3, spentUsd: 2.5, reservedUsd: 0.2, estimatedCostUsd: 0.3 }))
      .not.toThrow();
    expect(() => assertOpenAiBudgetAvailable({ budgetUsd: 3, spentUsd: 2.5, reservedUsd: 0.2, estimatedCostUsd: 0.300001 }))
      .toThrow('OpenAIの月額予算上限');
  });

  it('rejects usage when the already-recorded cost is over budget', () => {
    expect(() => assertOpenAiBudgetAvailable({ budgetUsd: 3, spentUsd: 3.1, reservedUsd: 0, estimatedCostUsd: 0.01 }))
      .toThrow('ローカル生成は引き続き利用できます');
  });

  it('uses configured token pricing and falls back to a fixed conservative estimate', () => {
    const priced = readOpenAiBudgetConfig({
      OPENAI_MONTHLY_BUDGET_USD: '5',
      OPENAI_INPUT_COST_PER_1M: '1',
      OPENAI_OUTPUT_COST_PER_1M: '10'
    });
    expect(estimateOpenAiRequestCost('1234', 100, priced)).toBe(0.001006);

    const fallback = readOpenAiBudgetConfig({ OPENAI_ESTIMATED_COST_PER_REQUEST_USD: '0.02' });
    expect(estimateOpenAiRequestCost('anything', 100, fallback)).toBe(0.02);
  });

  it('rejects an invalid configured budget instead of silently disabling the guard', () => {
    expect(() => readOpenAiBudgetConfig({ OPENAI_MONTHLY_BUDGET_USD: '3O' }))
      .toThrow('OPENAI_MONTHLY_BUDGET_USD は0以上の数値');
  });

  it('rejects a zero estimate when a monthly budget is configured', () => {
    const config = readOpenAiBudgetConfig({
      OPENAI_MONTHLY_BUDGET_USD: '3',
      OPENAI_ESTIMATED_COST_PER_REQUEST_USD: '0'
    });
    expect(() => estimateOpenAiRequestCost({}, 100, config)).toThrow('実行前見積額は0より大きい値');
  });

  it('returns a Japanese monthly summary', () => {
    expect(openAiMonthRange(new Date('2026-07-31T23:59:00Z')).month).toBe('2026-08');
    expect(openAiMonthRange(new Date('2026-07-01T00:00:00+09:00')).start.toISOString())
      .toBe('2026-06-30T15:00:00.000Z');
    expect(buildOpenAiUsageSummary({
      now: new Date('2026-07-19T00:00:00Z'),
      budgetUsd: 3,
      spentUsd: 1,
      reservedUsd: 0.5
    })).toMatchObject({
      month: '2026-07',
      configured: true,
      remainingUsd: 1.5,
      usagePercent: 50,
      blocked: false,
      statusMessage: 'OpenAIの今月の残り予算は概算 $1.5 です。'
    });
  });
});
