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
