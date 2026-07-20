import { Injectable } from '@nestjs/common';
import { AuditActor } from '../../audit/audit-actor';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class RequestMailReviewUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  execute(id: string, actor: AuditActor | null = null) {
    return actor
      ? this.mails.transitionIfDeliveryAllowed(id, 'in_review', 'reviewed', {}, undefined, actor)
      : this.mails.transitionIfDeliveryAllowed(id, 'in_review', 'reviewed');
  }
}
