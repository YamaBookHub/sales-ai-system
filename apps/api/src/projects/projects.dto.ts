import { ProjectStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsUUID()
  platformId!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  url!: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsInt()
  amount?: number;

  @IsOptional()
  @IsInt()
  supporterCount?: number;

  @IsOptional()
  @IsString()
  category?: string;
}

export class ImportCampfireProjectDto {
  @IsString()
  @MinLength(1)
  url!: string;
}

export class SearchCampfireProjectsDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  amountMin?: number;

  @IsOptional()
  @IsInt()
  amountMax?: number;

  @IsOptional()
  @IsInt()
  supporterMin?: number;

  @IsOptional()
  @IsInt()
  supporterMax?: number;

  @IsOptional()
  @IsInt()
  profileProjectMin?: number;

  @IsOptional()
  @IsInt()
  profileProjectMax?: number;

  @IsOptional()
  @IsString()
  status?: string;
}
