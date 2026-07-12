import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LeadStatus, ReplyCategory } from '@prisma/client';
import { ReplyInboxAttention, ReplyInboxDirection, ReplyInboxSort } from './domain/reply-inbox.repository';

const ATTENTION_VALUES: ReplyInboxAttention[] = ['all', 'needs_action', 'manager_review', 'stop_followup'];
const SORT_VALUES: ReplyInboxSort[] = ['receivedAt', 'priority', 'confidence'];
const DIRECTION_VALUES: ReplyInboxDirection[] = ['asc', 'desc'];

export class ReplyInboxQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(ReplyCategory)
  category?: ReplyCategory;

  @IsOptional()
  @IsIn(ATTENTION_VALUES)
  attention?: ReplyInboxAttention;

  @IsOptional()
  @IsEnum(LeadStatus)
  leadStatus?: LeadStatus;

  @IsOptional()
  @IsIn(SORT_VALUES)
  sort?: ReplyInboxSort;

  @IsOptional()
  @IsIn(DIRECTION_VALUES)
  direction?: ReplyInboxDirection;
}
