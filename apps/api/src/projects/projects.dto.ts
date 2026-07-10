import { ProjectStatus } from '@prisma/client';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export type ProjectSource = 'campfire' | 'makuake' | 'green_funding';

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

export class ImportProjectDto extends ImportCampfireProjectDto {
  @IsString()
  @MinLength(1)
  source!: ProjectSource;
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
  @IsInt()
  limit?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeUrls?: string[];
}

export class SearchProjectsDto extends SearchCampfireProjectsDto {
  @IsOptional()
  @IsString()
  source?: ProjectSource;
}
