import { Injectable } from '@nestjs/common';
import { assertCanMarkSent } from '../domain/mail-policy';
import { MarkMailSentDto } from '../mail.dto';
import { PrismaMailWorkflowRepository } from '../infrastructure/prisma-mail-workflow.repository';

@Injectable()
export class MarkMailSentUseCase {
  constructor(private readonly mails: PrismaMailWorkflowRepository) {}

  async execute(id: string, dto: MarkMailSentDto) {
    const email = await this.mails.get(id);
    assertCanMarkSent(email.status);
    const sentAt = dto.sentAt ? new Date(dto.sentAt) : new Date();
    const payload = email.status === 'sending'
      ? { manual: true, recoveredFrom: 'sending' }
      : { manual: true };
    return this.mails.transition(id, 'sent', 'sent', { sentAt }, payload);
  }
}
