import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailEventType, EmailStatus, Prisma } from '@prisma/client';
import { AuditActor } from '../../audit/audit-actor';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_CHECKLIST_ITEMS } from '../mail-checklist.defaults';
import { leadStatusForEmailStatus } from '../domain/mail-policy';
import { assertPersistedMailContactEligible } from './contact-eligibility.reader';
import { progressOpportunityInTransaction } from '../../leads/infrastructure/prisma-opportunity.repository';
import { mailAuditState, recordMailAudit } from './mail-audit';

@Injectable()
export class PrismaMailWorkflowRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(id: string, organizationId: string) {
    const email = await this.prisma.outreachEmail.findFirst({
      where: { id, organizationId },
      include: {
        lead: {
          select: {
            sendMethod: true,
            contactFormUrl: true,
            siteMessageUrl: true
          }
        }
      }
    });

    if (!email) {
      throw new NotFoundException('Mail not found');
    }

    return email;
  }

  async checklistComplete(emailId: string, organizationId: string) {
    await this.ensureDefaultChecklist(emailId, organizationId);
    const items = await this.prisma.mailChecklistItem.findMany({
      where: { organizationId, emailId },
      select: { checked: true }
    });

    return items.length > 0 && items.every((item) => item.checked);
  }

  transition(
    id: string,
    status: EmailStatus,
    eventType: EmailEventType,
    extra: Record<string, unknown> = {},
    payload: Prisma.InputJsonObject | undefined,
    actor: AuditActor
  ) {
    return this.prisma.$transaction((tx) => this.transitionInTransaction(
      tx, id, status, eventType, extra, withActor(payload, actor), actor
    ));
  }

  transitionIfDeliveryAllowed(
    id: string,
    status: EmailStatus,
    eventType: EmailEventType,
    extra: Record<string, unknown> = {},
    payload: Prisma.InputJsonObject | undefined,
    actor: AuditActor
  ) {
    return this.prisma.$transaction(async (tx) => {
      const destination = await assertPersistedMailContactEligible(tx, id, actor.organizationId, { lock: true });
      return this.transitionInTransaction(
        tx,
        id,
        status,
        eventType,
        { ...destinationFields(destination), ...extra },
        withActor(payload, actor),
        actor
      );
    });
  }

  async claimForSending(id: string, idempotencyKey: string, actor: AuditActor) {
    const email = await this.prisma.$transaction(async (tx) => {
      const destination = await assertPersistedMailContactEligible(tx, id, actor.organizationId, { lock: true });
      const before = await tx.outreachEmail.findFirst({ where: { id, organizationId: actor.organizationId } });
      const updated = await tx.outreachEmail.updateMany({
        where: { id, organizationId: actor.organizationId, status: 'queued' },
        data: { status: 'sending', ...destinationFields(destination) }
      });

      if (updated.count !== 1) {
        throw new ConflictException('このメールはすでに送信処理中、または送信対象ではありません。');
      }

      const claimedEmail = await tx.outreachEmail.findFirstOrThrow({
        where: { id, organizationId: actor.organizationId },
        include: {
          lead: {
            select: {
              sendMethod: true,
              contactFormUrl: true,
              siteMessageUrl: true
            }
          }
        }
      });
      await tx.emailEvent.create({
        data: {
          organizationId: actor.organizationId,
          emailId: id,
          type: 'sending',
          payload: withActor({ idempotencyKey }, actor)
        }
      });
      await recordMailAudit(tx, actor, 'mail.send_started', id, {
        before: mailAuditState(before),
        after: mailAuditState(claimedEmail)
      });

      return claimedEmail;
    });

    return email;
  }

  async assertDeliveryAllowed(id: string, organizationId: string) {
    await assertPersistedMailContactEligible(this.prisma, id, organizationId);
  }

  markSentAfterSend(
    id: string,
    result: { provider: string; messageId?: string; threadId?: string; sentAt: Date },
    idempotencyKey: string,
    actor: AuditActor
  ) {
    return this.transition(
      id,
      'sent',
      'sent',
      {
        provider: result.provider,
        gmailMessageId: result.messageId,
        gmailThreadId: result.threadId,
        sentAt: result.sentAt,
        failedReason: null
      },
      {
        idempotencyKey,
        provider: result.provider,
        messageId: result.messageId,
        threadId: result.threadId
      },
      actor
    );
  }

  markFailedAfterSend(id: string, error: unknown, idempotencyKey: string, actor: AuditActor) {
    const failedReason = safeMailFailureReason(error);
    return this.transition(id, 'failed', 'failed', { failedReason }, { idempotencyKey, failedReason }, actor);
  }

  private async ensureDefaultChecklist(emailId: string, organizationId: string) {
    const count = await this.prisma.mailChecklistItem.count({ where: { organizationId, emailId } });
    if (count > 0) return;

    await this.prisma.mailChecklistItem.createMany({
      data: DEFAULT_CHECKLIST_ITEMS.map((item) => ({
        organizationId,
        emailId,
        key: item.key,
        label: item.label,
        checked: false
      })),
      skipDuplicates: true
    });
  }

  private async transitionInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    status: EmailStatus,
    eventType: EmailEventType,
    extra: Record<string, unknown>,
    payload: Prisma.InputJsonObject | undefined,
    actor: AuditActor
  ) {
    const organizationId = actor.organizationId;
    const current = await tx.outreachEmail.findFirst({
      where: { id, organizationId },
      select: { status: true }
    });
    if (!current) throw new NotFoundException('Mail not found');
    if (current.status === status) {
      throw new ConflictException('このメールはすでに同じ状態へ更新されています。重複操作は記録しません。');
    }

    const email = await tx.outreachEmail.update({
      where: { organizationId_id: { organizationId, id } },
      data: {
        status,
        ...extra,
        // The nested relation uses the parent email's organizationId.
        events: { create: { type: eventType, payload } }
      }
    });

    const leadStatus = leadStatusForEmailStatus(status);
    if (leadStatus && email.leadId) {
      await tx.salesLead.update({
        where: { organizationId_id: { organizationId, id: email.leadId } },
        data: { status: leadStatus }
      });
    }

    if (status === 'sent' && email.leadId) {
      await progressOpportunityInTransaction(tx, {
          leadId: email.leadId,
          organizationId,
        toStage: 'contacted',
        sourceId: id,
        operationKey: `mail-sent:${id}`
      });
    }

    await recordMailAudit(tx, actor, mailAuditActionForTransition(status, eventType, payload), id, {
      before: mailAuditState(current),
      after: mailAuditState(email)
    });

    return email;
  }

}

export function safeMailFailureReason(error: unknown) {
  const status = httpErrorStatus(error);
  if (status) return `送信に失敗しました（status: ${status}）。`;
  const code = safeErrorCode(error);
  if (code) return `送信に失敗しました（code: ${code}）。`;
  return '送信に失敗しました。';
}

function httpErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as { getStatus?: () => unknown; status?: unknown };
  const status = typeof value.getStatus === 'function' ? value.getStatus() : value.status;
  return typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599 ? status : undefined;
}

function safeErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== 'string') return undefined;
  const normalized = code.trim().toUpperCase();
  return SAFE_MAIL_ERROR_CODES.has(normalized) ? normalized : undefined;
}

const SAFE_MAIL_ERROR_CODES = new Set([
  'ABORT_ERR',
  'ECONNREFUSED',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ETIMEDOUT'
]);

export function mailAuditActionForTransition(
  status: EmailStatus,
  eventType: EmailEventType,
  payload?: Prisma.InputJsonObject
) {
  if (status === 'in_review' && eventType === 'reviewed') {
    return payload?.reReview === true ? 'mail.rereview_requested' : 'mail.review_requested';
  }
  if (status === 'approved') return 'mail.approved';
  if (status === 'rejected') return 'mail.rejected';
  if (status === 'queued' && eventType === 'retried') return 'mail.retried';
  if (status === 'queued') return 'mail.queued';
  if (status === 'sent' && payload?.manual === true) return 'mail.marked_sent';
  if (status === 'sent') return 'mail.sent';
  if (status === 'failed') return 'mail.send_failed';
  return 'mail.send_failed';
}

function destinationFields(destination: { type: string; value: string; key: string } | null) {
  if (!destination) return {};
  return {
    destinationType: destination.type,
    destinationValue: destination.value,
    destinationKey: destination.key
  };
}

function withActor(payload: Prisma.InputJsonObject | undefined, actor?: AuditActor | null): Prisma.InputJsonObject | undefined {
  return actor ? { ...(payload || {}), actorUserId: actor.userId } : payload;
}
