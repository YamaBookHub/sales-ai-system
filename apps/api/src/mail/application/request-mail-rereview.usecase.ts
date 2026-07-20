import { Injectable } from '@nestjs/common';
import { assertCanRequestReReview } from '../domain/mail-policy';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class RequestMailReReviewUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  async execute(id: string, userId: string | null = null) {
    const email = await this.mails.get(id);
    assertCanRequestReReview(email.status);
    const args = [
      id,
      'in_review',
      'reviewed',
      { failedReason: null },
      { reReview: true }
    ] as const;
    return userId
      ? this.mails.transitionIfDeliveryAllowed(...args, userId)
      : this.mails.transitionIfDeliveryAllowed(...args);
  }
}
