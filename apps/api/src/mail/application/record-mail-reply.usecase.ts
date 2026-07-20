import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ReplyCategory } from '@prisma/client';
import { classifyReplyText } from '../../ai/domain/reply-classifier';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMailReplyDto } from '../mail.dto';
import { progressOpportunityInTransaction } from '../../leads/infrastructure/prisma-opportunity.repository';
import { mailAuditState, recordMailAudit } from '../infrastructure/mail-audit';

const TERMINAL_CATEGORIES: ReplyCategory[] = ['unsubscribe', 'not_interested'];

@Injectable()
export class RecordMailReplyUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(emailId: string, dto: CreateMailReplyDto, userId: string | null = null) {
    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();
    const classification = classifyReplyText(dto.body, receivedAt);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        `mail-reply:${emailId}:${dto.fromEmail || ''}:${dto.body.trim()}`
      );
      const email = await tx.outreachEmail.findUnique({
        where: { id: emailId },
        select: { id: true, companyId: true, contactId: true, leadId: true }
      });
      if (!email) throw new NotFoundException('Mail not found');

      const recentDuplicate = await tx.emailReply.findFirst({
        where: {
          emailId,
          fromEmail: dto.fromEmail ?? null,
          bodyText: dto.body,
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
        },
        select: { id: true }
      });
      if (recentDuplicate) throw new ConflictException('同じ返信はすでに記録されています。');

      const reply = await tx.emailReply.create({
        data: {
          emailId,
          fromEmail: dto.fromEmail,
          body: dto.body,
          bodyText: dto.body,
          category: classification.category,
          confidence: classification.confidence,
          summary: classification.summary,
          nextAction: classification.nextAction,
          receivedAt
        }
      });

      if (classification.category === 'unsubscribe') {
        if (email.contactId) {
          await tx.contactPerson.update({
            where: { id: email.contactId },
            data: { isUnsubscribed: true, unsubscribedAt: receivedAt, isPrimary: false }
          });
        } else if (dto.fromEmail) {
          await tx.contactPerson.updateMany({
            where: {
              companyId: email.companyId,
              email: { equals: dto.fromEmail, mode: 'insensitive' },
              deletedAt: null
            },
            data: { isUnsubscribed: true, unsubscribedAt: receivedAt, isPrimary: false }
          });
        }
      }

      let task: { id: string } | null = null;
      if (email.leadId) {
        const stopFollowup = TERMINAL_CATEGORIES.includes(classification.category);
        await tx.salesLead.update({
          where: { id: email.leadId },
          data: {
            status: classification.leadStatus,
            nextActionAt: classification.nextActionAt ?? null,
            ...(stopFollowup ? { nextFollowUpAt: null } : {})
          }
        });

        if (classification.nextActionAt) {
          task = await tx.task.create({
            data: {
              leadId: email.leadId,
              title: replyTaskTitle(classification.category),
              description: `${classification.summary}\n${classification.nextAction}`,
              dueAt: classification.nextActionAt
            }
          });
        }

        const opportunityStage = opportunityStageForReply(classification.category);
        if (opportunityStage) {
          await progressOpportunityInTransaction(tx, {
            leadId: email.leadId,
            toStage: opportunityStage,
            sourceId: reply.id,
            operationKey: `mail-reply:${reply.id}`
          });
        }
      }

      await tx.emailEvent.create({
        data: {
          emailId,
          type: 'replied',
          payload: {
            category: classification.category,
            confidence: classification.confidence,
            nextActionAt: classification.nextActionAt?.toISOString() ?? null,
            taskId: task?.id ?? null,
            ...(userId ? { actorUserId: userId } : {})
          }
        }
      });
      await recordMailAudit(tx, userId, 'mail.reply_recorded', email.id, {
        before: mailAuditState(email),
        after: {
          ...mailAuditState(email),
          replyCategory: classification.category,
          replyConfidence: classification.confidence,
          taskCreated: Boolean(task)
        }
      });

      return { reply, classification, task };
    });
  }
}

function opportunityStageForReply(category: ReplyCategory): 'contacted' | 'replied' | 'meeting' | null {
  if (category === 'meeting_request') return 'meeting';
  if (['interested', 'need_info', 'complaint', 'unknown'].includes(category)) return 'replied';
  if (category === 'auto_reply') return 'contacted';
  return null;
}

function replyTaskTitle(category: ReplyCategory) {
  const titles: Record<ReplyCategory, string> = {
    interested: '興味あり返信へ対応',
    need_info: '資料・詳細希望へ対応',
    meeting_request: '商談日程を調整',
    not_interested: '見送り返信を確認',
    unsubscribe: '配信停止を確認',
    auto_reply: '自動返信後の状況を確認',
    complaint: 'クレーム内容を確認',
    unknown: '返信内容を確認'
  };
  return titles[category];
}
