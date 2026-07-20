import { Injectable } from '@nestjs/common';
import { assertCanRetry } from '../domain/mail-policy';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class RetryMailUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  async execute(id: string, userId: string | null = null) {
    const email = await this.mails.get(id);
    assertCanRetry(email.status);
    return userId
      ? this.mails.transitionIfDeliveryAllowed(
        id, 'queued', 'retried', { retryCount: { increment: 1 } }, undefined, userId
      )
      : this.mails.transitionIfDeliveryAllowed(id, 'queued', 'retried', { retryCount: { increment: 1 } });
  }
}
