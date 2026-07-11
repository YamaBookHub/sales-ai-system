import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTrackedLinkDto {
  @IsUUID()
  emailId!: string;

  @IsString()
  @MinLength(1)
  originalUrl!: string;

  @IsOptional()
  @IsString()
  @IsIn(['company_material'])
  label?: string;
}

export class UnsubscribeDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  contactId?: string;
}
