import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateContactDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  inquiryUrl?: string | null;

  @IsOptional()
  @IsString()
  roleTitle?: string | null;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  inquiryUrl?: string | null;

  @IsOptional()
  @IsString()
  roleTitle?: string | null;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  isUnsubscribed?: boolean;
}
