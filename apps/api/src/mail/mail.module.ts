import { Module } from '@nestjs/common';
import { ApproveMailUseCase } from './application/approve-mail.usecase';
import { MarkMailSentUseCase } from './application/mark-mail-sent.usecase';
import { QueueMailUseCase } from './application/queue-mail.usecase';
import { RejectMailUseCase } from './application/reject-mail.usecase';
import { RequestMailReReviewUseCase } from './application/request-mail-rereview.usecase';
import { RequestMailReviewUseCase } from './application/request-mail-review.usecase';
import { RetryMailUseCase } from './application/retry-mail.usecase';
import { SendQueuedMailUseCase } from './application/send-queued-mail.usecase';
import { mailSenderProvider } from './infrastructure/mail-sender.config';
import { PrismaMailWorkflowRepository } from './infrastructure/prisma-mail-workflow.repository';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

@Module({
  controllers: [MailController],
  providers: [
    MailService,
    PrismaMailWorkflowRepository,
    RequestMailReviewUseCase,
    RequestMailReReviewUseCase,
    ApproveMailUseCase,
    RejectMailUseCase,
    QueueMailUseCase,
    MarkMailSentUseCase,
    RetryMailUseCase,
    SendQueuedMailUseCase,
    mailSenderProvider()
  ],
  exports: [MailService]
})
export class MailModule {}
