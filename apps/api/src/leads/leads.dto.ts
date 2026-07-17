import { LeadPriority, LeadStatus, PlatformType, ProjectStatus } from '@prisma/client';
import { IsDateString, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, Min } from 'class-validator';

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
