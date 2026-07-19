import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { SELECTABLE_AI_MODELS } from './domain/ai-model';
import type { SelectableAiModel } from './domain/ai-model';

export { SELECTABLE_AI_MODELS } from './domain/ai-model';
export type { SelectableAiModel } from './domain/ai-model';

export class GenerateMailDto {
  @IsUUID()
  analysisRevisionId!: string;

  @IsString()
  @MinLength(1)
  templateKey!: string;

  @IsOptional()
  @IsString()
  tone?: string;
}

export class UpdateLeadAnalysisDto {
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsString()
  @MinLength(32)
  @MaxLength(32)
  expectedSourceFingerprint!: string;

  @IsString()
  @MaxLength(1000)
  appeal!: string;

  @IsString()
  @MaxLength(1000)
  targetUser!: string;

  @IsString()
  @MaxLength(1000)
  videoIdea!: string;
}

export class SelectAiModelDto {
  @IsOptional()
  @IsIn(SELECTABLE_AI_MODELS)
  model?: SelectableAiModel;
}
