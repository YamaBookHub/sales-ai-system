import { Injectable } from '@nestjs/common';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class RequestMailReviewUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  execute(id: string) {
    return this.mails.transitionIfDeliveryAllowed(id, 'in_review', 'reviewed');
  }
}
