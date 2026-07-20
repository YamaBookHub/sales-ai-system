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

  async get(id: string) {
    const email = await this.prisma.outreachEmail.findUnique({
      where: { id },
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

  async checklistComplete(emailId: string) {
    await this.ensureDefaultChecklist(emailId);
    const items = await this.prisma.mailChecklistItem.findMany({
      where: { emailId },
      select: { checked: true }
    });

    return items.length > 0 && items.every((item) => item.checked);
  }

  transition(
    id: string,
    status: EmailStatus,
    eventType: EmailEventType,
    extra: Record<string, unknown> = {},
    payload?: Prisma.InputJsonObject,
    actor?: AuditActor | null
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
    payload?: Prisma.InputJsonObject,
    actor?: AuditActor | null
  ) {
    return this.prisma.$transaction(async (tx) => {
      const destination = await assertPersistedMailContactEligible(tx, id, { lock: true });
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
      const destination = await assertPersistedMailContactEligible(tx, id, { lock: true });
      const before = await tx.outreachEmail.findUnique({ where: { id } });
      const updated = await tx.outreachEmail.updateMany({
        where: { id, status: 'queued' },
        data: { status: 'sending', ...destinationFields(destination) }
      });

      if (updated.count !== 1) {
        throw new ConflictException('このメールはすでに送信処理中、または送信対象ではありません。');
      }

      const claimedEmail = await tx.outreachEmail.findUniqueOrThrow({
        where: { id },
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

  async assertDeliveryAllowed(id: string) {
    await assertPersistedMailContactEligible(this.prisma, id);
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
    const failedReason = error instanceof Error ? error.message : '送信に失敗しました';
    return this.transition(id, 'failed', 'failed', { failedReason }, { idempotencyKey, failedReason }, actor);
  }

  private async ensureDefaultChecklist(emailId: string) {
    const count = await this.prisma.mailChecklistItem.count({ where: { emailId } });
    if (count > 0) return;

    await this.prisma.mailChecklistItem.createMany({
      data: DEFAULT_CHECKLIST_ITEMS.map((item) => ({
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
    payload?: Prisma.InputJsonObject,
    actor?: AuditActor | null
  ) {
    const current = await tx.outreachEmail.findUnique({
      where: { id },
      select: { status: true }
    });
    if (!current) throw new NotFoundException('Mail not found');
    if (current.status === status) {
      throw new ConflictException('このメールはすでに同じ状態へ更新されています。重複操作は記録しません。');
    }

    const email = await tx.outreachEmail.update({
      where: { id },
      data: {
        status,
        ...extra,
        events: { create: { type: eventType, payload } }
      }
    });

    const leadStatus = leadStatusForEmailStatus(status);
    if (leadStatus && email.leadId) {
      await tx.salesLead.update({
        where: { id: email.leadId },
        data: { status: leadStatus }
      });
    }

    if (status === 'sent' && email.leadId) {
      await progressOpportunityInTransaction(tx, {
        leadId: email.leadId,
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
