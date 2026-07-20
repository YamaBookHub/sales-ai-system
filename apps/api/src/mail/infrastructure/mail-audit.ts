import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { AuditActor } from '../../audit/audit-actor';

export type MailAuditAction =
  | 'mail.created'
  | 'mail.edited'
  | 'mail.checklist_updated'
  | 'mail.review_requested'
  | 'mail.rereview_requested'
  | 'mail.rejected'
  | 'mail.approved'
  | 'mail.queued'
  | 'mail.marked_sent'
  | 'mail.send_started'
  | 'mail.sent'
  | 'mail.send_failed'
  | 'mail.retried'
  | 'mail.cancelled'
  | 'mail.reply_recorded'
  | 'mail_template.saved'
  | 'mail_template.imported';

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'>;

type MailAuditStateSource = {
  status?: string | null;
  leadId?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  destinationType?: string | null;
  destinationKey?: string | null;
  retryCount?: number | null;
} | null | undefined;

/**
 * Audit records deliberately contain only operational metadata. Mail content,
 * recipients, provider ids, and free-form rejection/reply text stay out of AuditLog.
 */
export async function recordMailAudit(
  tx: AuditClient,
  actor: AuditActor | null | undefined,
  action: MailAuditAction,
  emailId: string,
  details: { before?: Record<string, unknown>; after?: Record<string, unknown> } = {},
  entityType = 'OutreachEmail'
) {
  if (!actor) return;

  await tx.auditLog.create({
    data: {
      userId: actor.userId,
      sessionId: actor.sessionId,
      action,
      entityType,
      entityId: emailId,
      ...(details.before ? { before: details.before as Prisma.InputJsonObject } : {}),
      ...(details.after ? { after: details.after as Prisma.InputJsonObject } : {})
    }
  });
}

export function mailAuditState(email: MailAuditStateSource) {
  return {
    status: email?.status ?? null,
    leadId: email?.leadId ?? null,
    companyId: email?.companyId ?? null,
    retryCount: email?.retryCount ?? null,
    destinationType: email?.destinationType ?? null,
    hasContact: Boolean(email?.contactId),
    hasDestination: Boolean(email?.destinationKey)
  };
}

export function changedMailFields(
  before: { subject?: string | null; body?: string | null },
  update: { subject?: string; body?: string }
) {
  const changedFields: string[] = [];
  const contentHashes: Record<string, string> = {};

  for (const field of ['subject', 'body'] as const) {
    const value = update[field];
    if (value === undefined || value === before[field]) continue;
    changedFields.push(field);
    contentHashes[field] = sha256(value);
  }

  return { changedFields, contentHashes };
}

export function checklistAuditSummary(items: Array<{ key: string; checked: boolean }>) {
  return {
    changedKeys: items.map((item) => item.key),
    checkedCount: items.filter((item) => item.checked).length,
    totalCount: items.length,
    complete: items.length > 0 && items.every((item) => item.checked)
  };
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
