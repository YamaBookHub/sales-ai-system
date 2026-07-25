import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { SendQueuedMailUseCase } from './send-queued-mail.usecase';

const STALE_SENDING_MS = 15 * 60 * 1000;

@Injectable()
export class MailDispatchWorker {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sendQueuedMail: SendQueuedMailUseCase,
    private readonly logger: StructuredLogger
  ) {}

  async runOnce(now = new Date()) {
    const recovered = await this.recoverStaleSending(now);
    const candidate = await this.prisma.outreachEmail.findFirst({
      where: {
        status: 'queued',
        approvedById: { not: null },
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }]
      },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        organizationId: true,
        approvedById: true
      }
    });
    if (!candidate?.approvedById) return { dispatched: false, recovered };

    try {
      await this.sendQueuedMail.execute(candidate.id, {
        organizationId: candidate.organizationId,
        userId: candidate.approvedById
      });
      return { dispatched: true, recovered };
    } catch (error) {
      this.logger.warnEvent('mail.worker_dispatch_skipped', {
        organizationId: candidate.organizationId,
        entityType: 'OutreachEmail',
        entityId: candidate.id,
        operation: 'dispatch',
        error
      });
      return { dispatched: false, recovered };
    }
  }

  private async recoverStaleSending(now: Date) {
    const stale = await this.prisma.outreachEmail.findMany({
      where: {
        status: 'sending',
        updatedAt: { lt: new Date(now.getTime() - STALE_SENDING_MS) },
        approvedById: { not: null }
      },
      take: 20,
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true,
        organizationId: true,
        approvedById: true
      }
    });

    let recovered = 0;
    for (const email of stale) {
      const changed = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.outreachEmail.updateMany({
          where: {
            id: email.id,
            organizationId: email.organizationId,
            status: 'sending',
            updatedAt: { lt: new Date(now.getTime() - STALE_SENDING_MS) }
          },
          data: {
            status: 'failed',
            failedReason: '送信処理が中断され、結果が不明です。Gmailの送信済みを確認してから手動で再実行してください。'
          }
        });
        if (updated.count !== 1) return false;
        await tx.emailEvent.create({
          data: {
            organizationId: email.organizationId,
            emailId: email.id,
            type: 'failed',
            payload: {
              source: 'worker_recovery',
              deliveryOutcomeUnknown: true
            }
          }
        });
        if (email.approvedById) {
          await tx.auditLog.create({
            data: {
              organizationId: email.organizationId,
              userId: email.approvedById,
              action: 'mail.send_recovered_as_uncertain',
              entityType: 'OutreachEmail',
              entityId: email.id,
              after: {
                status: 'failed',
                deliveryOutcomeUnknown: true
              }
            }
          });
        }
        return true;
      });
      if (changed) recovered += 1;
    }
    return recovered;
  }
}
