import { EmailStatus, LeadPriority, LeadStatus, ReplyCategory } from '@prisma/client';

export type ReplyInboxRecord = {
  id: string;
  emailId: string;
  fromEmail?: string | null;
  body?: string | null;
  bodyText?: string | null;
  category?: ReplyCategory | null;
  confidence?: number | null;
  summary?: string | null;
  nextAction?: string | null;
  receivedAt: Date | string;
  email: {
    id: string;
    subject: string;
    status: EmailStatus;
    gmailThreadId?: string | null;
    sentAt?: Date | string | null;
    company: { id: string; name: string; isBlocked: boolean };
    contact?: {
      id: string;
      name?: string | null;
      email?: string | null;
      isUnsubscribed: boolean;
    } | null;
    lead?: {
      id: string;
      status: LeadStatus;
      priority: LeadPriority;
      score: number;
      nextActionAt?: Date | string | null;
      project?: { id: string; title: string; url: string } | null;
    } | null;
  };
};

export type ReplyInboxPriority = 'critical' | 'high' | 'normal' | 'low';

export type ReplyInboxItem = {
  id: string;
  emailId: string;
  fromEmail: string | null;
  bodyText: string;
  category: ReplyCategory;
  categoryLabel: string;
  confidence: number;
  summary: string | null;
  nextAction: string;
  receivedAt: string;
  priority: ReplyInboxPriority;
  priorityRank: number;
  mail: { id: string; subject: string; status: EmailStatus; gmailThreadId: string | null; sentAt: string | null };
  company: { id: string; name: string; isBlocked: boolean };
  contact: { id: string; name: string | null; email: string | null; isUnsubscribed: boolean } | null;
  lead: {
    id: string | null;
    status: LeadStatus | null;
    priority: LeadPriority | null;
    score: number | null;
    nextActionAt: string | null;
    project: { id: string; title: string; url: string } | null;
  };
  flags: { managerReviewRequired: boolean; stopFollowup: boolean; hasReply: true };
};

const CATEGORY_LABELS: Record<ReplyCategory, string> = {
  interested: '興味あり',
  need_info: '資料・詳細希望',
  meeting_request: '商談希望',
  not_interested: '見送り',
  unsubscribe: '配信停止',
  auto_reply: '自動返信',
  complaint: 'クレーム',
  unknown: '要確認'
};

export function buildReplyInboxViewModel(record: ReplyInboxRecord): ReplyInboxItem {
  const category = record.category || 'unknown';
  const priority = priorityFor(category);
  const contact = record.email.contact || null;
  const lead = record.email.lead || null;
  const managerReviewRequired = category === 'unsubscribe' || category === 'complaint' || category === 'unknown';
  const stopFollowup = category === 'unsubscribe' || category === 'not_interested' || record.email.company.isBlocked || Boolean(contact?.isUnsubscribed);

  return {
    id: record.id,
    emailId: record.emailId,
    fromEmail: record.fromEmail || null,
    bodyText: compactBody(record.bodyText || record.body || ''),
    category,
    categoryLabel: CATEGORY_LABELS[category],
    confidence: finiteConfidence(record.confidence),
    summary: trimOrNull(record.summary),
    nextAction: safeNextAction(category, record.nextAction),
    receivedAt: toIso(record.receivedAt),
    priority: priority.name,
    priorityRank: priority.rank,
    mail: {
      id: record.email.id,
      subject: record.email.subject,
      status: record.email.status,
      gmailThreadId: record.email.gmailThreadId || null,
      sentAt: toNullableIso(record.email.sentAt)
    },
    company: { id: record.email.company.id, name: record.email.company.name, isBlocked: record.email.company.isBlocked },
    contact: contact ? { id: contact.id, name: contact.name || null, email: contact.email || null, isUnsubscribed: contact.isUnsubscribed } : null,
    lead: {
      id: lead?.id || null,
      status: lead?.status || null,
      priority: lead?.priority || null,
      score: lead?.score ?? null,
      nextActionAt: toNullableIso(lead?.nextActionAt),
      project: lead?.project ? { id: lead.project.id, title: lead.project.title, url: lead.project.url } : null
    },
    flags: { managerReviewRequired, stopFollowup, hasReply: true }
  };
}

export function priorityRankForReplyCategory(category?: ReplyCategory | null) {
  if (category === 'unsubscribe' || category === 'complaint') return 4;
  if (category === 'unknown' || category === 'meeting_request' || category === 'interested' || category === 'need_info') return 3;
  if (category === 'not_interested') return 2;
  return 1;
}

function priorityFor(category: ReplyCategory): { name: ReplyInboxPriority; rank: number } {
  const rank = priorityRankForReplyCategory(category);
  return rank === 4 ? { name: 'critical', rank } : rank === 3 ? { name: 'high', rank } : rank === 2 ? { name: 'normal', rank } : { name: 'low', rank };
}

function safeNextAction(category: ReplyCategory, nextAction?: string | null) {
  if (category === 'unsubscribe') return '追客停止・配信停止を確認する。';
  if (category === 'complaint') return '内容を確認し、managerへ引き継ぐ。';
  if (category === 'unknown') return '返信内容を人間が確認する。';
  return trimOrNull(nextAction) || '返信内容を確認し、次対応を判断する。';
}

function compactBody(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 240 ? normalized.slice(0, 240) + '…' : normalized;
}

function trimOrNull(value?: string | null) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function finiteConfidence(value?: number | null) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value)));
}

function toNullableIso(value?: Date | string | null) {
  return value ? toIso(value) : null;
}

function toIso(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}
