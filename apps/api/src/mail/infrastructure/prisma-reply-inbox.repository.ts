import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { priorityRankForReplyCategory } from '../domain/reply-inbox';
import {
  ReplyInboxAttention,
  ReplyInboxDirection,
  ReplyInboxListQuery,
  ReplyInboxListResult,
  ReplyInboxRepository
} from '../domain/reply-inbox.repository';

const MAX_PAGE_SIZE = 100;
const REPLY_INBOX_SELECT = {
  id: true,
  emailId: true,
  fromEmail: true,
  body: true,
  bodyText: true,
  category: true,
  confidence: true,
  summary: true,
  nextAction: true,
  receivedAt: true,
  email: {
    select: {
      id: true,
      subject: true,
      status: true,
      gmailThreadId: true,
      sentAt: true,
      company: { select: { id: true, name: true, isBlocked: true } },
      contact: { select: { id: true, name: true, email: true, isUnsubscribed: true } },
      lead: {
        select: {
          id: true,
          status: true,
          priority: true,
          score: true,
          nextActionAt: true,
          project: { select: { id: true, title: true, url: true } }
        }
      }
    }
  }
} as const;

@Injectable()
export class PrismaReplyInboxRepository implements ReplyInboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ReplyInboxListQuery = {}): Promise<ReplyInboxListResult> {
    const page = normalizePage(query.page);
    const limit = normalizeLimit(query.limit);
    const where = buildReplyInboxWhere(query);
    const total = await this.prisma.emailReply.count({ where });

    if (query.sort === 'priority') {
      const orderedIds = await this.findPriorityOrderedIds(where, query.direction);
      const ids = orderedIds.slice((page - 1) * limit, page * limit);
      if (!ids.length) return { items: [], page, limit, total };
      const records = await this.prisma.emailReply.findMany({
        where: { id: { in: ids } },
        select: REPLY_INBOX_SELECT
      });
      return { items: orderByIds(records, ids), page, limit, total };
    }

    const orderBy = query.sort === 'confidence'
      ? [{ confidence: normalizeDirection(query.direction) }, { id: 'asc' as const }]
      : [{ receivedAt: normalizeDirection(query.direction) }, { id: 'asc' as const }];
    const items = await this.prisma.emailReply.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: REPLY_INBOX_SELECT
    });

    return { items, page, limit, total };
  }

  private async findPriorityOrderedIds(where: Prisma.EmailReplyWhereInput, direction?: ReplyInboxDirection) {
    const records = await this.prisma.emailReply.findMany({
      where,
      select: { id: true, category: true, receivedAt: true },
      orderBy: { receivedAt: normalizeDirection(direction) }
    });
    return records
      .sort((left, right) => {
        const priorityDifference = priorityRankForReplyCategory(left.category) - priorityRankForReplyCategory(right.category);
        if (priorityDifference) return normalizeDirection(direction) === 'asc' ? priorityDifference : -priorityDifference;
        const timeDifference = new Date(left.receivedAt).getTime() - new Date(right.receivedAt).getTime();
        if (timeDifference) return normalizeDirection(direction) === 'asc' ? timeDifference : -timeDifference;
        return left.id.localeCompare(right.id);
      })
      .map((record) => record.id);
  }
}

function buildReplyInboxWhere(query: ReplyInboxListQuery): Prisma.EmailReplyWhereInput {
  const and: Prisma.EmailReplyWhereInput[] = [];
  if (query.category) and.push({ category: query.category });
  if (query.leadStatus) and.push({ email: { is: { lead: { is: { status: query.leadStatus } } } } });

  const attention = attentionWhere(query.attention);
  if (attention) and.push(attention);

  return and.length ? { AND: and } : {};
}

function attentionWhere(attention?: ReplyInboxAttention): Prisma.EmailReplyWhereInput | null {
  if (!attention || attention === 'all') return null;
  if (attention === 'manager_review') {
    return { category: { in: ['unsubscribe', 'complaint', 'unknown'] } };
  }
  if (attention === 'stop_followup') {
    return {
      OR: [
        { category: { in: ['unsubscribe', 'not_interested'] } },
        { email: { is: { company: { is: { isBlocked: true } } } } },
        { email: { is: { contact: { is: { isUnsubscribed: true } } } } }
      ]
    };
  }
  return {
    OR: [
      { category: { in: ['interested', 'need_info', 'meeting_request', 'unsubscribe', 'complaint', 'unknown'] } },
      { email: { is: { company: { is: { isBlocked: true } } } } },
      { email: { is: { contact: { is: { isUnsubscribed: true } } } } }
    ]
  };
}

function normalizePage(value?: number) {
  return Number.isFinite(value) && Number(value) >= 1 ? Math.floor(Number(value)) : 1;
}

function normalizeLimit(value?: number) {
  if (!Number.isFinite(value) || Number(value) < 1) return 20;
  return Math.min(MAX_PAGE_SIZE, Math.floor(Number(value)));
}

function normalizeDirection(value?: ReplyInboxDirection): 'asc' | 'desc' {
  return value === 'asc' ? 'asc' : 'desc';
}

function orderByIds<T extends { id: string }>(records: T[], ids: string[]) {
  const byId = new Map(records.map((record) => [record.id, record]));
  return ids.map((id) => byId.get(id)).filter((record): record is T => Boolean(record));
}
