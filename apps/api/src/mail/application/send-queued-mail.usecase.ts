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
    const claimedEmail = await this.mails.claimForSending(id, idempotencyKey);

    try {
      const request = {
        idempotencyKey,
        toEmail: claimedEmail.toEmail,
        subject: claimedEmail.subject,
        body: claimedEmail.body
      } as Parameters<MailSender['send']>[0];
      if (claimedEmail.lead) {
        request.sendMethod = claimedEmail.lead.sendMethod;
        request.contactFormUrl = claimedEmail.lead.contactFormUrl;
        request.siteMessageUrl = claimedEmail.lead.siteMessageUrl;
      }
      const result = await this.sender.send(request);
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
