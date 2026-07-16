import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export const SELECTABLE_AI_MODELS = ['gpt-5.6-luna', 'gpt-5.6-sol'] as const;
export type SelectableAiModel = (typeof SELECTABLE_AI_MODELS)[number];

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
