import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';

export class CreateMailDraftDto {
  @IsUUID()
  leadId!: string;

  @IsString()
  @MinLength(1)
  templateKey!: string;

  @IsOptional()
  @IsString()
  manualInstruction?: string;
}

export class UpdateMailDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;
}

export class UpdateMailChecklistItemDto {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsBoolean()
  checked!: boolean;
}

export class UpdateMailChecklistDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateMailChecklistItemDto)
  items!: UpdateMailChecklistItemDto[];
}

export class RejectMailDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class MarkMailSentDto {
  @IsOptional()
  @IsDateString()
  sentAt?: string;
}

export class CreateMailReplyDto {
  @IsOptional()
  @IsString()
  fromEmail?: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;
}
