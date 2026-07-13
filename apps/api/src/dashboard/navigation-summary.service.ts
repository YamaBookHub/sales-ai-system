import { Injectable } from '@nestjs/common';
import { EmailStatus } from '@prisma/client';
import { classifyTodaySales } from '../leads/domain/today-sales';
import { ACTIVE_TASK_STATUSES } from '../leads/domain/task';
import { PrismaService } from '../prisma/prisma.service';

const ACTIONABLE_MAIL_STATUSES: EmailStatus[] = ['draft', 'in_review', 'approved', 'queued'];

@Injectable()
export class NavigationSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(now = new Date()) {
    const [leads, mailCount, replies] = await Promise.all([
      this.prisma.salesLead.findMany({
        select: {
          status: true,
          nextActionAt: true,
          nextFollowUpAt: true,
          tasks: {
            where: { status: { in: ACTIVE_TASK_STATUSES } },
            orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
            take: 1,
            select: { dueAt: true }
          },
          mails: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { status: true }
          }
        }
      }),
      this.prisma.outreachEmail.count({ where: { status: { in: ACTIONABLE_MAIL_STATUSES } } }),
      this.prisma.emailReply.count()
    ]);

    const today = leads.filter((lead) => {
      const nextTaskDueAt = lead.tasks[0]?.dueAt || null;
      return Boolean(classifyTodaySales({
        nextActionAt: nextTaskDueAt || lead.nextActionAt,
        nextFollowUpAt: nextTaskDueAt ? null : lead.nextFollowUpAt,
        mailStatus: lead.mails[0]?.status,
        hasReply: lead.status === 'replied'
      }, now));
    }).length;

    return {
      today,
      replies,
      leads: leads.length,
      mail: mailCount
    };
  }
}
