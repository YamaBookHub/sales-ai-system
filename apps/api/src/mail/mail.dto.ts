import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';

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
