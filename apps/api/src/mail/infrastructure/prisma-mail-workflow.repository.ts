import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailEventType, EmailStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_CHECKLIST_ITEMS } from '../mail-checklist.defaults';
import { leadStatusForEmailStatus } from '../domain/mail-policy';
import { assertMailDeliveryAllowed, MailDeliverySnapshot } from '../domain/contact-delivery-policy';

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
    payload?: Prisma.InputJsonObject
  ) {
    return this.prisma.$transaction((tx) => this.transitionInTransaction(tx, id, status, eventType, extra, payload));
  }

  transitionIfDeliveryAllowed(
    id: string,
    status: EmailStatus,
    eventType: EmailEventType,
    extra: Record<string, unknown> = {},
    payload?: Prisma.InputJsonObject
  ) {
    return this.prisma.$transaction(async (tx) => {
      assertMailDeliveryAllowed(await this.deliverySnapshot(tx, id));
      return this.transitionInTransaction(tx, id, status, eventType, extra, payload);
    });
  }

  retry(id: string) {
    return this.prisma.outreachEmail.update({
      where: { id },
      data: {
        status: 'queued',
        retryCount: { increment: 1 },
        events: { create: { type: 'retried' } }
      }
    });
  }

  async claimForSending(id: string, idempotencyKey: string) {
    const email = await this.prisma.$transaction(async (tx) => {
      assertMailDeliveryAllowed(await this.deliverySnapshot(tx, id));
      const updated = await tx.outreachEmail.updateMany({
        where: { id, status: 'queued' },
        data: { status: 'sending' }
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
          payload: { idempotencyKey }
        }
      });

      return claimedEmail;
    });

    return email;
  }

  async assertDeliveryAllowed(id: string) {
    assertMailDeliveryAllowed(await this.deliverySnapshot(this.prisma, id));
  }

  markSentAfterSend(
    id: string,
    result: { provider: string; messageId?: string; threadId?: string; sentAt: Date },
    idempotencyKey: string
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
      }
    );
  }

  markFailedAfterSend(id: string, error: unknown, idempotencyKey: string) {
    const failedReason = error instanceof Error ? error.message : '送信に失敗しました';
    return this.transition(id, 'failed', 'failed', { failedReason }, { idempotencyKey, failedReason });
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
    payload?: Prisma.InputJsonObject
  ) {
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

    return email;
  }

  private async deliverySnapshot(reader: PrismaService | Prisma.TransactionClient, id: string): Promise<MailDeliverySnapshot> {
    const email = await reader.outreachEmail.findUnique({
      where: { id },
      select: {
        companyId: true,
        contactId: true,
        toEmail: true,
        company: { select: { isBlocked: true } },
        contact: { select: { deletedAt: true, isUnsubscribed: true } }
      }
    });
    if (!email) throw new NotFoundException('Mail not found');

    const legacyMatchedContact = !email.contactId && email.toEmail
      ? await reader.contactPerson.findFirst({
        where: {
          companyId: email.companyId,
          email: { equals: email.toEmail, mode: 'insensitive' },
          OR: [{ deletedAt: { not: null } }, { isUnsubscribed: true }]
        },
        select: { deletedAt: true, isUnsubscribed: true }
      })
      : null;

    return { company: email.company, contact: email.contact, legacyMatchedContact };
  }
}
