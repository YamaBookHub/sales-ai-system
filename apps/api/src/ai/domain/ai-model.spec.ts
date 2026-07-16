import {
  aiProviderForModel,
  DEFAULT_AI_MODEL,
  isGeminiModel,
  resolveRequestedAiModel
} from './ai-model';

describe('AI model selection', () => {
  const originalDefault = process.env.AI_DEFAULT_MODEL;
  const originalOpenAiModel = process.env.OPENAI_MODEL;

  afterEach(() => {
    if (originalDefault === undefined) delete process.env.AI_DEFAULT_MODEL;
    else process.env.AI_DEFAULT_MODEL = originalDefault;
    if (originalOpenAiModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalOpenAiModel;
  });

  it('uses Gemini Flash-Lite as the new default', () => {
    delete process.env.AI_DEFAULT_MODEL;
    delete process.env.OPENAI_MODEL;

    expect(DEFAULT_AI_MODEL).toBe('gemini-3.1-flash-lite');
    expect(resolveRequestedAiModel()).toBe('gemini-3.1-flash-lite');
  });

  it('prefers request, then the general setting, then the legacy OpenAI setting', () => {
    process.env.AI_DEFAULT_MODEL = 'gemini-3.5-flash';
    process.env.OPENAI_MODEL = 'gpt-5.6-luna';

    expect(resolveRequestedAiModel('gpt-5.6-sol')).toBe('gpt-5.6-sol');
    expect(resolveRequestedAiModel()).toBe('gemini-3.5-flash');
    delete process.env.AI_DEFAULT_MODEL;
    expect(resolveRequestedAiModel()).toBe('gpt-5.6-luna');
  });

  it('identifies the provider from the model', () => {
    expect(isGeminiModel('gemini-3.1-flash-lite')).toBe(true);
    expect(aiProviderForModel('gemini-3.5-flash')).toBe('gemini');
    expect(aiProviderForModel('gpt-5.6-luna')).toBe('openai');
  });
});
