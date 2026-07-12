import { Inject, Injectable } from '@nestjs/common';
import { assertCanSendQueued } from '../domain/mail-policy';
import { MAIL_SENDER, MailSender } from '../domain/mail-sender';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class SendQueuedMailUseCase {
  constructor(
    private readonly mails: PrismaMailWorkflowRepository,
    @Inject(MAIL_SENDER)
    private readonly sender: MailSender
  ) {}

  async execute(id: string) {
    const email = await this.mails.get(id);
    const checklistComplete = await this.mails.checklistComplete(id);
    assertCanSendQueued(email.status, checklistComplete);

    const idempotencyKey = buildMailSendIdempotencyKey(email);
    const request = buildMailSendRequest(email, idempotencyKey);
    this.sender.validate?.(request);
    const claimedEmail = await this.mails.claimForSending(id, idempotencyKey);

    try {
      const result = await this.sender.send(buildMailSendRequest(claimedEmail, idempotencyKey));
      return this.mails.markSentAfterSend(id, result, idempotencyKey);
    } catch (error) {
      await this.mails.markFailedAfterSend(id, error, idempotencyKey);
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
  lead?: { sendMethod?: string | null; contactFormUrl?: string | null; siteMessageUrl?: string | null } | null;
}, idempotencyKey: string) {
  return {
    idempotencyKey,
    toEmail: email.toEmail,
    subject: email.subject,
    body: email.body,
    sendMethod: email.lead?.sendMethod,
    contactFormUrl: email.lead?.contactFormUrl,
    siteMessageUrl: email.lead?.siteMessageUrl
  };
}
