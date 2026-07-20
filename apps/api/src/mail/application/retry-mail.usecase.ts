import { Injectable } from '@nestjs/common';
import { AuditActor } from '../../audit/audit-actor';
import { assertCanRetry } from '../domain/mail-policy';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class RetryMailUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  async execute(id: string, actor: AuditActor) {
    const email = await this.mails.get(id, actor.organizationId);
    assertCanRetry(email.status);
    return this.mails.transitionIfDeliveryAllowed(
      id, 'queued', 'retried', { retryCount: { increment: 1 } }, undefined, actor
    );
  }
}
