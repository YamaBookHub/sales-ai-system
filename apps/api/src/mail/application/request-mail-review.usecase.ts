import { Injectable } from '@nestjs/common';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class RequestMailReviewUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  execute(id: string, userId: string | null = null) {
    return userId
      ? this.mails.transitionIfDeliveryAllowed(id, 'in_review', 'reviewed', {}, undefined, userId)
      : this.mails.transitionIfDeliveryAllowed(id, 'in_review', 'reviewed');
  }
}
