import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuditActor } from '../../audit/audit-actor';
import { classifyReplyText } from '../domain/reply-classifier';

@Injectable()
export class ClassifyReplyUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(replyId: string, actor: AuditActor) {
    const organizationId = actor.organizationId;
    const reply = await this.prisma.emailReply.findFirst({
      where: { id: replyId, organizationId },
      include: { email: true }
    });

    if (!reply) {
      throw new NotFoundException('Reply not found');
    }

    const classification = classifyReplyText(reply.bodyText || reply.body);

    return this.prisma.$transaction(async (tx) => {
      const updatedReply = await tx.emailReply.update({
        where: { organizationId_id: { organizationId, id: replyId } },
        data: {
          category: classification.category,
          confidence: classification.confidence,
          summary: classification.summary,
          nextAction: classification.nextAction
        }
      });

      if (reply.email.leadId) {
        await tx.salesLead.update({
          where: { organizationId_id: { organizationId, id: reply.email.leadId } },
          data: {
            status: classification.leadStatus,
            nextActionAt: classification.nextActionAt
          }
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actor.userId,
          sessionId: actor.sessionId,
          action: 'reply.classify',
          entityType: 'EmailReply',
          entityId: replyId,
          after: { category: classification.category, confidence: classification.confidence }
        }
      });

      return { reply: updatedReply, classification };
    });
  }
}
