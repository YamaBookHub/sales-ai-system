import { Injectable } from '@nestjs/common';
import { assertCanRetry } from '../domain/mail-policy';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class RetryMailUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  async execute(id: string) {
    const email = await this.mails.get(id);
    assertCanRetry(email.status);
    return this.mails.retry(id);
  }
}
