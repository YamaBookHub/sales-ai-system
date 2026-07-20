import { Injectable } from '@nestjs/common';
import { AuditActor } from '../../audit/audit-actor';
import { assertCanRetry } from '../domain/mail-policy';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class RetryMailUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  async execute(id: string, actor: AuditActor | null = null) {
    const email = await this.mails.get(id);
    assertCanRetry(email.status);
    return actor
      ? this.mails.transitionIfDeliveryAllowed(
        id, 'queued', 'retried', { retryCount: { increment: 1 } }, undefined, actor
      )
      : this.mails.transitionIfDeliveryAllowed(id, 'queued', 'retried', { retryCount: { increment: 1 } });
  }
}
