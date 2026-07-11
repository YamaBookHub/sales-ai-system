import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { classifyReplyText } from '../domain/reply-classifier';

@Injectable()
export class ClassifyReplyUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(replyId: string) {
    const reply = await this.prisma.emailReply.findUnique({
      where: { id: replyId },
      include: { email: true }
    });

    if (!reply) {
      throw new NotFoundException('Reply not found');
    }

    const classification = classifyReplyText(reply.bodyText || reply.body);

    return this.prisma.$transaction(async (tx) => {
      const updatedReply = await tx.emailReply.update({
        where: { id: replyId },
        data: {
          category: classification.category,
          confidence: classification.confidence,
          summary: classification.summary,
          nextAction: classification.nextAction
        }
      });

      if (reply.email.leadId) {
        await tx.salesLead.update({
          where: { id: reply.email.leadId },
          data: {
            status: classification.leadStatus,
            nextActionAt: classification.nextActionAt
          }
        });
      }

      return { reply: updatedReply, classification };
    });
  }
}
