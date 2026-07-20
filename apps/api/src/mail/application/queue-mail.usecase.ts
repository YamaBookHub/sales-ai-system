import { Injectable } from '@nestjs/common';
import { AuditActor } from '../../audit/audit-actor';
import { assertCanQueue } from '../domain/mail-policy';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class QueueMailUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  async execute(id: string, actor: AuditActor) {
    const email = await this.mails.get(id, actor.organizationId);
    const checklistComplete = await this.mails.checklistComplete(id, actor.organizationId);
    assertCanQueue(email.status, checklistComplete);
    return this.mails.transitionIfDeliveryAllowed(id, 'queued', 'queued', {}, undefined, actor);
  }
}
