import { LeadStatus, ReplyCategory } from '@prisma/client';
import { ReplyInboxRecord } from './reply-inbox';

export type ReplyInboxAttention = 'all' | 'needs_action' | 'manager_review' | 'stop_followup';
export type ReplyInboxSort = 'receivedAt' | 'priority' | 'confidence';
export type ReplyInboxDirection = 'asc' | 'desc';

export type ReplyInboxListQuery = {
  page?: number;
  limit?: number;
  category?: ReplyCategory;
  attention?: ReplyInboxAttention;
  leadStatus?: LeadStatus;
  sort?: ReplyInboxSort;
  direction?: ReplyInboxDirection;
};

export type ReplyInboxListResult = {
  items: ReplyInboxRecord[];
  page: number;
  limit: number;
  total: number;
};

export interface ReplyInboxRepository {
  list(query?: ReplyInboxListQuery): Promise<ReplyInboxListResult>;
}
