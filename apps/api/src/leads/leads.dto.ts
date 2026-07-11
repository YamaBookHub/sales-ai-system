import { LeadPriority, LeadStatus, PlatformType, ProjectStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

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

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  projectTitle?: string;

  @IsOptional()
  @IsString()
  projectUrl?: string;

  @IsOptional()
  @IsEnum(PlatformType)
  projectSource?: PlatformType;

  @IsOptional()
  @IsEnum(ProjectStatus)
  projectStatus?: ProjectStatus;

  @IsOptional()
  @IsInt()
  projectAmount?: number;

  @IsOptional()
  @IsInt()
  projectSupporterCount?: number;

  @IsOptional()
  @IsInt()
  projectTargetAmount?: number;

  @IsOptional()
  @IsDateString()
  projectEndDate?: string;

  @IsOptional()
  @IsString()
  projectCategory?: string;

  @IsOptional()
  @IsString()
  projectDescription?: string;
}
