import { Injectable } from '@nestjs/common';
import { AuditActor } from '../../audit/audit-actor';
import { assertChecklistComplete } from '../domain/mail-policy';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class ApproveMailUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  async execute(id: string, actor: AuditActor | null = null) {
    assertChecklistComplete(await this.mails.checklistComplete(id));
    const approvedAt = new Date();
    return actor
      ? this.mails.transitionIfDeliveryAllowed(
        id, 'approved', 'approved', { approvedAt, approvedById: actor.userId }, undefined, actor
      )
      : this.mails.transitionIfDeliveryAllowed(id, 'approved', 'approved', { approvedAt });
  }
}
