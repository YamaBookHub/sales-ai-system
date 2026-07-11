import { Injectable } from '@nestjs/common';
import { assertChecklistComplete } from '../domain/mail-policy';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class ApproveMailUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  async execute(id: string) {
    assertChecklistComplete(await this.mails.checklistComplete(id));
    return this.mails.transition(id, 'approved', 'approved', { approvedAt: new Date() });
  }
}
