import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { SELECTABLE_AI_MODELS } from './domain/ai-model';
import type { SelectableAiModel } from './domain/ai-model';

export { SELECTABLE_AI_MODELS } from './domain/ai-model';
export type { SelectableAiModel } from './domain/ai-model';

export class GenerateMailDto {
  @IsString()
  @MinLength(1)
  templateKey!: string;

  @IsOptional()
  @IsString()
  tone?: string;
}

export class SelectAiModelDto {
  @IsOptional()
  @IsIn(SELECTABLE_AI_MODELS)
  model?: SelectableAiModel;
}
