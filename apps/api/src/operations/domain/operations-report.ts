export const OPERATIONS_TIMEZONE = 'Asia/Tokyo';
export const OPERATIONS_MAX_DAYS = 90;

export const OPERATIONS_SOURCES = ['campfire', 'makuake', 'green_funding', 'other'] as const;
export const OPERATIONS_REPLY_CATEGORIES = [
  'interested',
  'need_info',
  'meeting_request',
  'not_interested',
  'unsubscribe',
  'auto_reply',
  'complaint',
  'unknown'
] as const;
export const OPERATIONS_MAIL_STATUSES = [
  'draft',
  'in_review',
  'rejected',
  'approved',
  'queued',
  'sending',
  'sent',
  'failed',
  'cancelled'
] as const;

export type OperationsSource = (typeof OPERATIONS_SOURCES)[number];
export type OperationsReplyCategory = (typeof OPERATIONS_REPLY_CATEGORIES)[number];
export type OperationsMailStatus = (typeof OPERATIONS_MAIL_STATUSES)[number];
export type OperationsSearchStatus = 'completed' | 'failed' | 'cancelled';

export type OperationsPeriod = {
  from: string;
  to: string;
  timezone: typeof OPERATIONS_TIMEZONE;
  asOf: string;
  startUtc: Date;
  endExclusiveUtc: Date;
};

export type OperationsReportData = {
  aiRows: Array<{
    status: 'completed' | 'failed' | 'reserved';
    estimatedCostUsd: number;
    actualCostUsd: number | null;
  }>;
  terminalSearches: Array<{
    source: OperationsSource;
    status: OperationsSearchStatus;
    durationMs: number;
  }>;
  runningSearches: Array<{ source: OperationsSource }>;
  imports: Array<{
    action: 'projects.import' | 'projects.import_failed' | 'projects.bulk_import';
    source: OperationsSource;
    requested: number;
    imported: number;
    failed: number;
    analysisFailed: number;
  }>;
  replies: Array<{ category: OperationsReplyCategory; count: number }>;
  mails: Array<{ status: OperationsMailStatus; count: number }>;
  stuckSendingCount: number;
  staleReservedAiCount: number;
};

export type OperationsAlertCode =
  | 'ai_failed'
  | 'search_failed'
  | 'import_failed'
  | 'mail_failed'
  | 'mail_sending_stuck'
  | 'ai_reserved_stuck';

export type OperationsAlert = {
  code: OperationsAlertCode;
  severity: 'warning' | 'critical';
  label: string;
  value: number;
};

export class OperationsPeriodError extends Error {
  constructor(readonly code: 'invalid_date' | 'reversed_range' | 'range_too_long') {
    super(code);
  }
}

export function resolveOperationsPeriod(input: { from?: string; to?: string }, now = new Date()): OperationsPeriod {
  const today = tokyoDateKey(now);
  const to = input.to || today;
  const from = input.from || addCalendarDays(to, -29);

  if (!isCalendarDate(from) || !isCalendarDate(to)) throw new OperationsPeriodError('invalid_date');
  if (from > to) throw new OperationsPeriodError('reversed_range');
  if (calendarDayDistance(from, to) + 1 > OPERATIONS_MAX_DAYS) throw new OperationsPeriodError('range_too_long');

  return {
    from,
    to,
    timezone: OPERATIONS_TIMEZONE,
    asOf: now.toISOString(),
    startUtc: tokyoDayStartUtc(from),
    endExclusiveUtc: tokyoDayStartUtc(addCalendarDays(to, 1))
  };
}

export function buildOperationsReport(period: OperationsPeriod, data: OperationsReportData) {
  const ai = data.aiRows.reduce(
    (summary, row) => {
      summary[row.status] += 1;
      summary.costUsd += row.status === 'reserved'
        ? row.estimatedCostUsd
        : row.actualCostUsd ?? row.estimatedCostUsd;
      return summary;
    },
    { costUsd: 0, completed: 0, failed: 0, reserved: 0 }
  );
  const searchBySource = zeroCounts(OPERATIONS_SOURCES);
  const searchStatus = { completed: 0, failed: 0, cancelled: 0 };
  const durations: number[] = [];
  for (const row of data.terminalSearches) {
    searchBySource[row.source] += 1;
    searchStatus[row.status] += 1;
    durations.push(row.durationMs);
  }
  for (const row of data.runningSearches) searchBySource[row.source] += 1;

  const imports = data.imports.reduce(
    (summary, row) => {
      summary.runs += 1;
      summary.requested += row.requested;
      summary.imported += row.imported;
      summary.failed += row.failed;
      summary.analysisFailed += row.analysisFailed;
      return summary;
    },
    { runs: 0, requested: 0, imported: 0, failed: 0, analysisFailed: 0 }
  );
  const replies = zeroCounts(OPERATIONS_REPLY_CATEGORIES);
  for (const row of data.replies) replies[row.category] += row.count;
  const mails = zeroCounts(OPERATIONS_MAIL_STATUSES);
  for (const row of data.mails) mails[row.status] += row.count;

  const searches = {
    total: data.terminalSearches.length + data.runningSearches.length,
    ...searchStatus,
    running: data.runningSearches.length,
    averageDurationMs: durations.length === 0 ? 0 : Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length),
    maxDurationMs: durations.length === 0 ? 0 : Math.max(...durations),
    bySource: searchBySource
  };
  const replyTotal = Object.values(replies).reduce((sum, value) => sum + value, 0);
  const mailTotal = Object.values(mails).reduce((sum, value) => sum + value, 0);
  const alerts = buildAlerts({
    aiFailures: ai.failed,
    searchFailures: searches.failed,
    importFailures: imports.failed,
    mailFailures: mails.failed,
    stuckSending: data.stuckSendingCount,
    staleReservedAi: data.staleReservedAiCount
  });

  return {
    period: { from: period.from, to: period.to, timezone: period.timezone, asOf: period.asOf },
    ai: {
      costUsd: roundUsd(ai.costUsd),
      completed: ai.completed,
      failed: ai.failed,
      reserved: ai.reserved,
      total: ai.completed + ai.failed + ai.reserved
    },
    searches,
    imports,
    replies: { total: replyTotal, byCategory: replies },
    mails: { total: mailTotal, byStatus: mails },
    alerts
  };
}

function buildAlerts(input: {
  aiFailures: number;
  searchFailures: number;
  importFailures: number;
  mailFailures: number;
  stuckSending: number;
  staleReservedAi: number;
}): OperationsAlert[] {
  const candidates: Array<OperationsAlert> = [
    { code: 'ai_failed', severity: 'warning', label: 'AI処理の失敗', value: input.aiFailures },
    { code: 'search_failed', severity: 'warning', label: '検索処理の失敗', value: input.searchFailures },
    { code: 'import_failed', severity: 'warning', label: '取込処理の失敗', value: input.importFailures },
    { code: 'mail_failed', severity: 'warning', label: 'メール送信の失敗', value: input.mailFailures },
    { code: 'mail_sending_stuck', severity: 'critical', label: '送信中のまま15分以上経過したメール', value: input.stuckSending },
    { code: 'ai_reserved_stuck', severity: 'critical', label: '30分以上未確定のAI利用予約', value: input.staleReservedAi }
  ];
  return candidates.filter((alert) => alert.value > 0);
}

function zeroCounts<T extends readonly string[]>(keys: T): Record<T[number], number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T[number], number>;
}

function roundUsd(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 1_000_000) / 1_000_000;
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function addCalendarDays(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function calendarDayDistance(from: string, to: string) {
  return (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000;
}

function tokyoDayStartUtc(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) - 9 * 60 * 60 * 1000);
}

function tokyoDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATIONS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}
