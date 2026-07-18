import { EmailStatus, LeadPriority, LeadStatus, PlatformType, ProjectStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min } from 'class-validator';

export const LEAD_CONTACT_STATES = ['has', 'none'] as const;
export const LEAD_NEXT_ACTION_FILTERS = ['any', 'scheduled', 'overdue', 'none'] as const;
export const LEAD_LIST_SORTS = ['company', 'project', 'amount', 'supporters', 'daysLeft', 'score', 'priority', 'createdAt'] as const;
export const SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type LeadContactState = (typeof LEAD_CONTACT_STATES)[number];
export type LeadNextActionFilter = (typeof LEAD_NEXT_ACTION_FILTERS)[number];
export type LeadListSort = (typeof LEAD_LIST_SORTS)[number];
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export class ListLeadsQueryDto {
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
  @IsString()
  @MaxLength(200)
  keyword?: string;

  @IsOptional()
  @IsEnum(PlatformType)
  source?: PlatformType;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsEnum(LeadPriority)
  priority?: LeadPriority;

  @IsOptional()
  @IsIn(LEAD_CONTACT_STATES)
  contactState?: LeadContactState;

  @IsOptional()
  @IsIn(['none', ...Object.values(EmailStatus)])
  mailStatus?: EmailStatus | 'none';

  @IsOptional()
  @IsIn(LEAD_NEXT_ACTION_FILTERS)
  nextAction?: LeadNextActionFilter;

  @IsOptional()
  @IsIn(LEAD_LIST_SORTS)
  sort?: LeadListSort;

  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  sortDirection?: SortDirection;
}

export class CreateLeadDto {
  @IsUUID()
  companyId!: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  ownerMemo?: string;

  @IsOptional()
  @IsDateString()
  nextActionAt?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactFormUrl?: string;

  @IsOptional()
  @IsString()
  siteMessageUrl?: string;

  @IsOptional()
  @IsString()
  contactMemo?: string;

  @IsOptional()
  @IsString()
  sendMethod?: string;

  @IsOptional()
  @IsDateString()
  sentAt?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string;

  @IsOptional()
  @IsString()
  brandWebsiteUrl?: string;

  @IsOptional()
  @IsString()
  instagramUrl?: string;

  @IsOptional()
  @IsString()
  tiktokUrl?: string;

  @IsOptional()
  @IsString()
  xUrl?: string;

  @IsOptional()
  @IsString()
  brandAnalysisMemo?: string;

  @IsOptional()
  @IsString()
  snsAnalysisMemo?: string;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsEnum(LeadPriority)
  priority?: LeadPriority;

  @IsOptional()
  @IsString()
  ownerMemo?: string | null;

  @IsOptional()
  @IsDateString()
  nextActionAt?: string | null;

  @IsOptional()
  @IsEmail()
  contactEmail?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  contactFormUrl?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  siteMessageUrl?: string | null;

  @IsOptional()
  @IsString()
  contactMemo?: string | null;

  @IsOptional()
  @IsString()
  sendMethod?: string | null;

  @IsOptional()
  @IsDateString()
  sentAt?: string | null;

  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  brandWebsiteUrl?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  instagramUrl?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  tiktokUrl?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  xUrl?: string | null;

  @IsOptional()
  @IsString()
  brandAnalysisMemo?: string | null;

  @IsOptional()
  @IsString()
  snsAnalysisMemo?: string | null;

  @IsOptional()
  @IsString()
  leadReason?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  companyName?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  companyWebsiteUrl?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  companyInquiryUrl?: string | null;

  @IsOptional()
  @IsString()
  companyIndustry?: string | null;

  @IsOptional()
  @IsString()
  companyLocation?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  companySourceTotalAmount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  companySourceProjectCount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  companySourceSupporterCount?: number | null;

  @IsOptional()
  @IsString()
  companyMemo?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  projectTitle?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  projectUrl?: string;

  @IsOptional()
  @IsEnum(PlatformType)
  projectSource?: PlatformType;

  @IsOptional()
  @IsEnum(ProjectStatus)
  projectStatus?: ProjectStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  projectAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  projectSupporterCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  projectTargetAmount?: number | null;

  @IsOptional()
  @IsDateString()
  projectStartDate?: string | null;

  @IsOptional()
  @IsDateString()
  projectEndDate?: string | null;

  @IsOptional()
  @IsString()
  projectCategory?: string | null;

  @IsOptional()
  @IsString()
  projectLocation?: string | null;

  @IsOptional()
  @IsString()
  projectDescription?: string | null;
}
