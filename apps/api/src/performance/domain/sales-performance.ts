export const SALES_PERFORMANCE_TIMEZONE = 'Asia/Tokyo';

export const SALES_PERFORMANCE_SOURCES = [
  'campfire',
  'makuake',
  'green_funding',
  'other',
  'manual'
] as const;

export type SalesPerformanceSource = (typeof SALES_PERFORMANCE_SOURCES)[number];

export const SALES_LOSS_REASONS = [
  'no_interest',
  'no_budget',
  'timing',
  'no_response',
  'competitor',
  'service_mismatch',
  'contact_unavailable',
  'duplicate',
  'other'
] as const;

export type SalesLossReason = (typeof SALES_LOSS_REASONS)[number];

export type SalesPerformancePeriod = {
  from: string;
  to: string;
  timezone: typeof SALES_PERFORMANCE_TIMEZONE;
  asOf: string;
  startUtc: Date;
  endExclusiveUtc: Date;
};

export type SalesPerformanceCounts = {
  sentMessages: number;
  contactedLeads: number;
  repliedLeads: number;
  meetingLeads: number;
  wonLeads: number;
  lostLeads: number;
  lossReasonCounts: Partial<Record<SalesLossReason, number>>;
};

export class SalesPerformancePeriodError extends Error {
  constructor(readonly code: 'invalid_date' | 'invalid_range') {
    super(code);
  }
}

const LOSS_REASON_LABELS: Record<SalesLossReason, string> = {
  no_interest: '関心なし',
  no_budget: '予算なし',
  timing: '時期が合わない',
  no_response: '返信途絶',
  competitor: '他社採用',
  service_mismatch: '支援内容が合わない',
  contact_unavailable: '有効な連絡先なし',
  duplicate: '重複案件・重複接触',
  other: 'その他'
};

export function resolveSalesPerformancePeriod(
  input: { from?: string; to?: string },
  now = new Date()
): SalesPerformancePeriod {
  const today = tokyoDateKey(now);
  const to = input.to || today;
  const from = input.from || addCalendarDays(to, -29);

  if (!isCalendarDate(from) || !isCalendarDate(to)) {
    throw new SalesPerformancePeriodError('invalid_date');
  }
  if (from > to) throw new SalesPerformancePeriodError('invalid_range');

  return {
    from,
    to,
    timezone: SALES_PERFORMANCE_TIMEZONE,
    asOf: now.toISOString(),
    startUtc: tokyoDayStartUtc(from),
    endExclusiveUtc: tokyoDayStartUtc(addCalendarDays(to, 1))
  };
}

export function buildSalesPerformanceReport(
  period: SalesPerformancePeriod,
  filters: { ownerId?: string; source?: SalesPerformanceSource },
  counts: SalesPerformanceCounts
) {
  const denominator = counts.contactedLeads;
  const lossReasons = SALES_LOSS_REASONS.map((reason) => ({
    reason,
    label: LOSS_REASON_LABELS[reason],
    count: counts.lossReasonCounts[reason] || 0,
    share: percentage(counts.lossReasonCounts[reason] || 0, counts.lostLeads)
  })).filter((item) => item.count > 0);

  return {
    period: {
      from: period.from,
      to: period.to,
      timezone: period.timezone,
      asOf: period.asOf
    },
    filters: {
      ownerId: filters.ownerId || null,
      source: filters.source || null
    },
    counts,
    rates: {
      replyRate: percentage(counts.repliedLeads, denominator),
      meetingRate: percentage(counts.meetingLeads, denominator),
      wonRate: percentage(counts.wonLeads, denominator)
    },
    lossReasons
  };
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function tokyoDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SALES_PERFORMANCE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addCalendarDays(value: string, days: number) {
  if (!isCalendarDate(value)) throw new SalesPerformancePeriodError('invalid_date');
  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

function tokyoDayStartUtc(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) - 9 * 60 * 60 * 1000);
}
