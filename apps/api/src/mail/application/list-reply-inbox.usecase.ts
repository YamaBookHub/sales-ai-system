import { Injectable } from '@nestjs/common';
import { buildReplyInboxViewModel, ReplyInboxItem } from '../domain/reply-inbox';
import { ReplyInboxListQuery } from '../domain/reply-inbox.repository';
import { PrismaReplyInboxRepository } from '../infrastructure/prisma-reply-inbox.repository';

@Injectable()
export class ListReplyInboxUseCase {
  constructor(private readonly replies: PrismaReplyInboxRepository) {}

  async execute(query: ReplyInboxListQuery = {}) {
    const result = await this.replies.list(query);
    return {
      items: result.items.map(buildReplyInboxViewModel),
      page: result.page,
      limit: result.limit,
      total: result.total
    } satisfies { items: ReplyInboxItem[]; page: number; limit: number; total: number };
  }
}
