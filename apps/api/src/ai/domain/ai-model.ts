export const GEMINI_AI_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash'] as const;
export const OPENAI_AI_MODELS = ['gpt-4.1-mini', 'gpt-5.6-luna', 'gpt-5.6-sol'] as const;
export const SELECTABLE_AI_MODELS = [...GEMINI_AI_MODELS, ...OPENAI_AI_MODELS] as const;

export type SelectableGeminiModel = (typeof GEMINI_AI_MODELS)[number];
export type SelectableOpenAiModel = (typeof OPENAI_AI_MODELS)[number];
export type SelectableAiModel = (typeof SELECTABLE_AI_MODELS)[number];
export type AiProvider = 'gemini' | 'openai';

export const DEFAULT_AI_MODEL: SelectableAiModel = 'gemini-3.1-flash-lite';

export function isSelectableAiModel(value: string): value is SelectableAiModel {
  return (SELECTABLE_AI_MODELS as readonly string[]).includes(value);
}

export function isGeminiModel(model: SelectableAiModel): model is SelectableGeminiModel {
  return (GEMINI_AI_MODELS as readonly string[]).includes(model);
}

export function aiProviderForModel(model: SelectableAiModel | string): AiProvider {
  return model.trim().toLowerCase().startsWith('gemini-') ? 'gemini' : 'openai';
}

export function resolveRequestedAiModel(requestedModel?: SelectableAiModel): SelectableAiModel {
  if (requestedModel) return requestedModel;

  const configuredModel = process.env.AI_DEFAULT_MODEL?.trim();
  if (configuredModel && isSelectableAiModel(configuredModel)) return configuredModel;

  // Keep existing API clients compatible when only the former OpenAI setting exists.
  const legacyOpenAiModel = process.env.OPENAI_MODEL?.trim();
  if (legacyOpenAiModel && isSelectableAiModel(legacyOpenAiModel)) return legacyOpenAiModel;

  return DEFAULT_AI_MODEL;
}
