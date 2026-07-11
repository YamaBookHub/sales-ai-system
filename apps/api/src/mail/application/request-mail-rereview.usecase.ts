import { Injectable } from '@nestjs/common';
import { assertCanRequestReReview } from '../domain/mail-policy';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class RequestMailReReviewUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  async execute(id: string) {
    const email = await this.mails.get(id);
    assertCanRequestReReview(email.status);
    return this.mails.transition(id, 'in_review', 'reviewed', { failedReason: null }, { reReview: true });
  }
}
