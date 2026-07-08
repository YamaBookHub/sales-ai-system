import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  inquiryUrl?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  memo?: string;
}

export class BlockCompanyDto {
  @IsOptional()
  @IsString()
  blockedReason?: string;
}
