import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

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
