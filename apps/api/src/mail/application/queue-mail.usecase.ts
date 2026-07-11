import { Injectable } from '@nestjs/common';
import { assertCanQueue } from '../domain/mail-policy';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class QueueMailUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  async execute(id: string) {
    const email = await this.mails.get(id);
    const checklistComplete = await this.mails.checklistComplete(id);
    assertCanQueue(email.status, checklistComplete);
    return this.mails.transition(id, 'queued', 'queued');
  }
}
