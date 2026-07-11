import { Injectable } from '@nestjs/common';
import { assertCanReject } from '../domain/mail-policy';
import { RejectMailDto } from '../mail.dto';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class RejectMailUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  async execute(id: string, dto: RejectMailDto) {
    const email = await this.mails.get(id);
    assertCanReject(email.status);
    const reason = dto.reason?.trim() || 'rejected_by_reviewer';
    return this.mails.transition(id, 'rejected', 'rejected', { failedReason: reason, approvedAt: null }, { reason });
  }
}
