import { OpportunityLossReason, OpportunityStage, PlatformType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min
} from 'class-validator';

export class ListOpportunitiesQueryDto {
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
  @IsEnum(OpportunityStage)
  stage?: OpportunityStage;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsEnum(PlatformType)
  source?: PlatformType;

  @IsOptional()
  @IsDateString()
  expectedCloseFrom?: string;

  @IsOptional()
  @IsDateString()
  expectedCloseTo?: string;

  @IsOptional()
  @IsDateString()
  updatedFrom?: string;

  @IsOptional()
  @IsDateString()
  updatedTo?: string;
}

export class UpdateOpportunityDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedAmount?: number | null;

  @IsOptional()
  @IsDateString()
  meetingScheduledAt?: string | null;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string | null;
}

class UpdateOpportunityFieldsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedAmount?: number;

  @IsOptional()
  @IsDateString()
  meetingScheduledAt?: string | null;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string | null;
}

export class TransitionOpportunityDto extends UpdateOpportunityFieldsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsUUID()
  operationKey!: string;

  @IsEnum(OpportunityStage)
  toStage!: OpportunityStage;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  wonAmount?: number;

  @IsOptional()
  @IsEnum(OpportunityLossReason)
  lossReason?: OpportunityLossReason;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  lossReasonDetail?: string;
}

export class ReopenOpportunityDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsUUID()
  operationKey!: string;

  @IsEnum(OpportunityStage)
  toStage!: OpportunityStage;

  @IsString()
  @MaxLength(2000)
  reason!: string;
}

export class ListOpportunityHistoryQueryDto {
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
}
