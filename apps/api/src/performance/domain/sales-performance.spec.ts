import {
  buildSalesPerformanceReport,
  resolveSalesPerformancePeriod
} from './sales-performance';

describe('sales performance domain', () => {
  it('defaults to the latest 30 Tokyo calendar days', () => {
    const period = resolveSalesPerformancePeriod({}, new Date('2026-07-19T02:30:00.000Z'));

    expect(period).toMatchObject({
      from: '2026-06-20',
      to: '2026-07-19',
      timezone: 'Asia/Tokyo',
      asOf: '2026-07-19T02:30:00.000Z'
    });
    expect(period.startUtc.toISOString()).toBe('2026-06-19T15:00:00.000Z');
    expect(period.endExclusiveUtc.toISOString()).toBe('2026-07-19T15:00:00.000Z');
  });

  it('uses inclusive dates and Tokyo midnight boundaries', () => {
    const period = resolveSalesPerformancePeriod(
      { from: '2026-07-01', to: '2026-07-02' },
      new Date('2026-07-03T00:00:00.000Z')
    );

    expect(period.startUtc.toISOString()).toBe('2026-06-30T15:00:00.000Z');
    expect(period.endExclusiveUtc.toISOString()).toBe('2026-07-02T15:00:00.000Z');
  });

  it.each([
    [{ from: '2026-02-30', to: '2026-03-01' }, 'invalid_date' as const],
    [{ from: '2026-07-02', to: '2026-07-01' }, 'invalid_range' as const]
  ])('rejects invalid periods', (input, code) => {
    expect(() => resolveSalesPerformancePeriod(input)).toThrow(code);
  });

  it('calculates all rates from contacted leads and loss shares from lost leads', () => {
    const period = resolveSalesPerformancePeriod(
      { from: '2026-07-01', to: '2026-07-31' },
      new Date('2026-08-01T00:00:00.000Z')
    );
    const report = buildSalesPerformanceReport(period, { source: 'campfire' }, {
      sentMessages: 5,
      contactedLeads: 4,
      repliedLeads: 3,
      meetingLeads: 2,
      wonLeads: 1,
      lostLeads: 2,
      lossReasonCounts: { no_budget: 1, timing: 1 }
    });

    expect(report.rates).toEqual({ replyRate: 75, meetingRate: 50, wonRate: 25 });
    expect(report.lossReasons).toEqual([
      { reason: 'no_budget', label: '予算なし', count: 1, share: 50 },
      { reason: 'timing', label: '時期が合わない', count: 1, share: 50 }
    ]);
  });

  it('returns zero-safe rates and no NaN values', () => {
    const period = resolveSalesPerformancePeriod({ from: '2026-07-01', to: '2026-07-01' });
    const report = buildSalesPerformanceReport(period, {}, {
      sentMessages: 0,
      contactedLeads: 0,
      repliedLeads: 0,
      meetingLeads: 0,
      wonLeads: 0,
      lostLeads: 0,
      lossReasonCounts: {}
    });

    expect(report.rates).toEqual({ replyRate: 0, meetingRate: 0, wonRate: 0 });
    expect(report.lossReasons).toEqual([]);
  });
});
