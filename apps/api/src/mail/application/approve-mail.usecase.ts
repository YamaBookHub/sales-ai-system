import { Injectable } from '@nestjs/common';
import { assertChecklistComplete } from '../domain/mail-policy';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class ApproveMailUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  async execute(id: string, userId: string | null = null) {
    assertChecklistComplete(await this.mails.checklistComplete(id));
    const approvedAt = new Date();
    return userId
      ? this.mails.transitionIfDeliveryAllowed(
        id, 'approved', 'approved', { approvedAt, approvedById: userId }, undefined, userId
      )
      : this.mails.transitionIfDeliveryAllowed(id, 'approved', 'approved', { approvedAt });
  }
}
