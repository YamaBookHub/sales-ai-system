export type TodaySalesCategory =
  | 'overdue'
  | 'due_today'
  | 'draft_review'
  | 'approval_pending'
  | 'send_queue'
  | 'reply_received'
  | 'send_failed';

export type TodaySalesInput = {
  nextActionAt?: Date | string | null;
  nextFollowUpAt?: Date | string | null;
  mailStatus?: string | null;
  hasReply?: boolean;
};

export function classifyTodaySales(input: TodaySalesInput, now = new Date()): TodaySalesCategory | null {
  const dueDate = input.nextActionAt || input.nextFollowUpAt;
  const dueCategory = classifyDueDate(dueDate, now);
  if (dueCategory) return dueCategory;
  if (input.hasReply) return 'reply_received';
  if (input.mailStatus === 'failed') return 'send_failed';
  if (input.mailStatus === 'draft') return 'draft_review';
  if (input.mailStatus === 'approved') return 'approval_pending';
  if (input.mailStatus === 'queued') return 'send_queue';
  return null;
}

export function tokyoDateKey(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function classifyDueDate(value: Date | string | null | undefined, now: Date): TodaySalesCategory | null {
  const dueDate = tokyoDateKey(value);
  const today = tokyoDateKey(now);
  if (!dueDate || !today || dueDate > today) return null;
  return dueDate < today ? 'overdue' : 'due_today';
}
