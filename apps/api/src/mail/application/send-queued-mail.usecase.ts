import { Inject, Injectable } from '@nestjs/common';
import { AuditActor } from '../../audit/audit-actor';
import { assertCanSendQueued } from '../domain/mail-policy';
import { MAIL_SENDER, MailSender } from '../domain/mail-sender';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';
import { StructuredLogger } from '../../common/logging/structured-logger.service';

@Injectable()
export class SendQueuedMailUseCase {
  constructor(
    private readonly mails: PrismaMailWorkflowRepository,
    @Inject(MAIL_SENDER)
    private readonly sender: MailSender,
    private readonly logger: StructuredLogger
  ) {}

  async execute(id: string, actor: AuditActor) {
    const email = await this.mails.get(id, actor.organizationId);
    const checklistComplete = await this.mails.checklistComplete(id, actor.organizationId);
    assertCanSendQueued(email.status, checklistComplete);

    const idempotencyKey = buildMailSendIdempotencyKey(email);
    const request = buildMailSendRequest(email, idempotencyKey, actor.organizationId);
    this.sender.validate?.(request);
    const claimedEmail = await this.mails.claimForSending(id, idempotencyKey, actor);

    try {
      // A contact can be unsubscribed after queueing; check once more immediately before the provider call.
      await this.mails.assertDeliveryAllowed(id, actor.organizationId);
      const result = await this.sender.send(buildMailSendRequest(claimedEmail, idempotencyKey, actor.organizationId));
      return this.mails.markSentAfterSend(id, result, idempotencyKey, actor);
    } catch (error) {
      this.logger.errorEvent('mail.send_failed', {
        userId: actor.userId,
        organizationId: actor.organizationId,
        entityType: 'OutreachEmail',
        entityId: id,
        operation: 'send',
        error
      });
      await this.mails.markFailedAfterSend(id, error, idempotencyKey, actor);
      throw error;
    }
  }
}

function buildMailSendIdempotencyKey(email: { id: string; retryCount?: number | null }) {
  return `mail:${email.id}:retry:${email.retryCount ?? 0}`;
}

function buildMailSendRequest(email: {
  toEmail?: string | null;
  subject: string;
  body: string;
  unsubscribeToken?: string | null;
  lead?: { sendMethod?: string | null; contactFormUrl?: string | null; siteMessageUrl?: string | null } | null;
}, idempotencyKey: string, organizationId: string) {
  return {
    idempotencyKey,
    organizationId,
    toEmail: email.toEmail,
    subject: email.subject,
    body: email.body,
    unsubscribeToken: email.unsubscribeToken,
    sendMethod: email.lead?.sendMethod,
    contactFormUrl: email.lead?.contactFormUrl,
    siteMessageUrl: email.lead?.siteMessageUrl
  };
}
