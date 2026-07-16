import { chatCompletionOptions, DEFAULT_OPENAI_MODEL, OpenAiClientService, resolveOpenAiModelId } from './openai-client.service';

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

  it('keeps the explicit SOL and LUNA API model ids', () => {
    expect(resolveOpenAiModelId('gpt-4.1-mini')).toBe('gpt-4.1-mini');
    expect(resolveOpenAiModelId('gpt-5.6-sol')).toBe('gpt-5.6-sol');
    expect(resolveOpenAiModelId('gpt-5.6-luna')).toBe('gpt-5.6-luna');
  });

  it('keeps compatible options for legacy models', () => {
    expect(chatCompletionOptions('gpt-4.1-mini', 1200, 0.2)).toEqual({
      temperature: 0.2,
      max_tokens: 1200
    });
  });

  it('uses a request-level model instead of the environment default', async () => {
    const originalApiKey = process.env.OPENAI_API_KEY;
    const originalModel = process.env.OPENAI_MODEL;
    const originalFetch = global.fetch;
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_MODEL = 'gpt-5.6-luna';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              matchesProject: true,
              suspectedForeignFacts: [],
              reason: '案件内容と一致しています。',
              confidence: 0.9
            })
          }
        }]
      }))
    });
    global.fetch = fetchMock as typeof fetch;

    try {
      const result = await new OpenAiClientService().checkSemanticConsistency(
        { companyName: 'テスト株式会社', body: 'テスト本文' },
        'gpt-5.6-sol'
      );
      const request = JSON.parse(fetchMock.mock.calls[0][1].body);

      expect(request.model).toBe('gpt-5.6-sol');
      expect(request.reasoning_effort).toBe('medium');
      expect(result.model).toBe('gpt-5.6-sol');
    } finally {
      if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalApiKey;
      if (originalModel === undefined) delete process.env.OPENAI_MODEL;
      else process.env.OPENAI_MODEL = originalModel;
      global.fetch = originalFetch;
    }
  });
});
