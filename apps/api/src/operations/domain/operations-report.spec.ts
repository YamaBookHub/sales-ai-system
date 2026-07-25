import { buildOperationsReport, OperationsPeriodError, resolveOperationsPeriod } from './operations-report';

describe('operations report domain', () => {
  const now = new Date('2026-07-25T03:00:00.000Z');

  it('uses the last 30 inclusive JST calendar days by default', () => {
    expect(resolveOperationsPeriod({}, now)).toMatchObject({
      from: '2026-06-26',
      to: '2026-07-25',
      timezone: 'Asia/Tokyo'
    });
  });

  it('accepts exactly 90 inclusive calendar days and rejects a longer period', () => {
    expect(resolveOperationsPeriod({ from: '2026-04-27', to: '2026-07-25' }, now)).toMatchObject({
      from: '2026-04-27',
      to: '2026-07-25'
    });
    expect(() => resolveOperationsPeriod({ from: '2026-04-26', to: '2026-07-25' }, now))
      .toThrow(new OperationsPeriodError('range_too_long'));
  });

  it('rejects malformed and reversed dates', () => {
    expect(() => resolveOperationsPeriod({ from: '2026-02-30', to: '2026-07-25' }, now))
      .toThrow(new OperationsPeriodError('invalid_date'));
    expect(() => resolveOperationsPeriod({ from: '2026-07-26', to: '2026-07-25' }, now))
      .toThrow(new OperationsPeriodError('reversed_range'));
  });

  it('returns zero-safe aggregate values and no alerts for zero data', () => {
    const period = resolveOperationsPeriod({}, now);
    const report = buildOperationsReport(period, {
      aiRows: [], terminalSearches: [], runningSearches: [], imports: [], replies: [], mails: [],
      stuckSendingCount: 0, staleReservedAiCount: 0
    });

    expect(report).toMatchObject({
      ai: { costUsd: 0, completed: 0, failed: 0, reserved: 0, total: 0 },
      searches: { total: 0, completed: 0, failed: 0, cancelled: 0, running: 0, averageDurationMs: 0, maxDurationMs: 0 },
      imports: { runs: 0, requested: 0, imported: 0, failed: 0, analysisFailed: 0 },
      replies: { total: 0 },
      mails: { total: 0 },
      alerts: []
    });
  });

  it('aggregates committed and reserved AI cost, safe statuses, and alerts', () => {
    const report = buildOperationsReport(resolveOperationsPeriod({}, now), {
      aiRows: [
        { status: 'completed', estimatedCostUsd: 0.1, actualCostUsd: 0.04 },
        { status: 'failed', estimatedCostUsd: 0.2, actualCostUsd: null },
        { status: 'reserved', estimatedCostUsd: 0.03, actualCostUsd: null }
      ],
      terminalSearches: [
        { source: 'campfire', status: 'completed', durationMs: 100 },
        { source: 'makuake', status: 'failed', durationMs: 300 },
        { source: 'campfire', status: 'cancelled', durationMs: 200 }
      ],
      runningSearches: [{ source: 'makuake' }],
      imports: [
        { action: 'projects.import', source: 'campfire', requested: 1, imported: 1, failed: 0, analysisFailed: 0 },
        { action: 'projects.bulk_import', source: 'makuake', requested: 4, imported: 2, failed: 2, analysisFailed: 1 }
      ],
      replies: [{ category: 'interested', count: 2 }],
      mails: [{ status: 'sent', count: 3 }, { status: 'failed', count: 1 }],
      stuckSendingCount: 2,
      staleReservedAiCount: 1
    });

    expect(report.ai).toEqual({ costUsd: 0.27, completed: 1, failed: 1, reserved: 1, total: 3 });
    expect(report.searches).toMatchObject({
      total: 4, completed: 1, failed: 1, cancelled: 1, running: 1, averageDurationMs: 200, maxDurationMs: 300,
      bySource: { campfire: 2, makuake: 2, green_funding: 0, other: 0 }
    });
    expect(report.imports).toEqual({ runs: 2, requested: 5, imported: 3, failed: 2, analysisFailed: 1 });
    expect(report.replies).toMatchObject({ total: 2, byCategory: { interested: 2, unknown: 0 } });
    expect(report.mails).toMatchObject({ total: 4, byStatus: { sent: 3, failed: 1 } });
    expect(report.alerts.map((alert) => alert.code)).toEqual([
      'ai_failed', 'search_failed', 'import_failed', 'mail_failed', 'mail_sending_stuck', 'ai_reserved_stuck'
    ]);
  });
});
