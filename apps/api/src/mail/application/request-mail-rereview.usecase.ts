import { Injectable } from '@nestjs/common';
import { AuditActor } from '../../audit/audit-actor';
import { assertCanRequestReReview } from '../domain/mail-policy';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class RequestMailReReviewUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  async execute(id: string, actor: AuditActor) {
    const email = await this.mails.get(id, actor.organizationId);
    assertCanRequestReReview(email.status);
    const args = [
      id,
      'in_review',
      'reviewed',
      { failedReason: null },
      { reReview: true }
    ] as const;
    return this.mails.transitionIfDeliveryAllowed(...args, actor);
  }
}
