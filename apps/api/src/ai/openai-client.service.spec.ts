import { chatCompletionOptions, DEFAULT_OPENAI_MODEL, resolveOpenAiModelId } from './openai-client.service';

describe('openai-client model options', () => {
  it('uses LUNA as the default model', () => {
    expect(DEFAULT_OPENAI_MODEL).toBe('gpt-5.6-luna');
  });

  it('uses the current completion-token parameter for GPT-5.6 models', () => {
    expect(chatCompletionOptions('gpt-5.6', 1200, 0.2)).toEqual({
      max_completion_tokens: 1200,
      reasoning_effort: 'medium'
    });
    expect(chatCompletionOptions('gpt-5.6-luna', 400, 0)).toEqual({
      max_completion_tokens: 400,
      reasoning_effort: 'low'
    });
  });

  it('maps the SOL configuration name to the API model id', () => {
    expect(resolveOpenAiModelId('gpt-5.6-sol')).toBe('gpt-5.6');
    expect(resolveOpenAiModelId('gpt-5.6-luna')).toBe('gpt-5.6-luna');
  });

  it('keeps compatible options for legacy models', () => {
    expect(chatCompletionOptions('gpt-4.1-mini', 1200, 0.2)).toEqual({
      temperature: 0.2,
      max_tokens: 1200
    });
  });
});
