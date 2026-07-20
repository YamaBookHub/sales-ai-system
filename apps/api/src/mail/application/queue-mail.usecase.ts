import { Injectable } from '@nestjs/common';
import { AuditActor } from '../../audit/audit-actor';
import { assertCanQueue } from '../domain/mail-policy';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class QueueMailUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  async execute(id: string, actor: AuditActor | null = null) {
    const email = await this.mails.get(id);
    const checklistComplete = await this.mails.checklistComplete(id);
    assertCanQueue(email.status, checklistComplete);
    return actor
      ? this.mails.transitionIfDeliveryAllowed(id, 'queued', 'queued', {}, undefined, actor)
      : this.mails.transitionIfDeliveryAllowed(id, 'queued', 'queued');
  }
}
