import { ServiceUnavailableException } from '@nestjs/common';
import { GeminiClientService } from './gemini-client.service';

describe('GeminiClientService', () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uses structured JSON and cost-minimal thinking for Flash-Lite', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    const generated = {
      subject: '仮件名',
      body: '仮本文',
      factsUsed: ['商品名'],
      assumptions: [],
      riskFlags: []
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] }, finishReason: 'STOP' }],
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 10,
          thoughtsTokenCount: 5,
          totalTokenCount: 115
        }
      }))
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await new GeminiClientService().createSalesMailDraft(
      {
        templateKey: 'normal',
        companyName: 'テスト株式会社',
        projectTitle: 'テスト商品',
        projectPlatformName: 'CAMPFIRE',
        projectDescription: '持ち運びしやすい商品です。'
      },
      'gemini-3.1-flash-lite'
    );
    const [url, options] = fetchMock.mock.calls[0];
    const request = JSON.parse(options.body);

    expect(url).toContain('/models/gemini-3.1-flash-lite:generateContent');
    expect(options.headers['x-goog-api-key']).toBe('test-gemini-key');
    expect(request.generationConfig).toMatchObject({
      maxOutputTokens: 1600,
      thinkingConfig: { thinkingLevel: 'MINIMAL' },
      responseMimeType: 'application/json'
    });
    expect(request.generationConfig.responseSchema.required).toEqual([
      'subject',
      'body',
      'factsUsed',
      'assumptions',
      'riskFlags'
    ]);
    expect(result.model).toBe('gemini-3.1-flash-lite');
    expect(result.usage).toMatchObject({ inputTokens: 100, outputTokens: 15, totalTokens: 115, costUsd: 0.0000475 });
  });

  it('uses low thinking for the quality-oriented Flash model', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        candidates: [{
          content: { parts: [{ text: JSON.stringify({
            matchesProject: true,
            suspectedForeignFacts: [],
            reason: '一致しています。',
            confidence: 0.9
          }) }] }
        }]
      }))
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await new GeminiClientService().checkSemanticConsistency(
      { companyName: 'テスト株式会社', body: '本文' },
      'gemini-3.5-flash'
    );
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(request.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
    expect(result).toMatchObject({ model: 'gemini-3.5-flash', matchesProject: true });
  });

  it('returns a clear error when the Gemini key is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(new GeminiClientService().checkSemanticConsistency(
      { companyName: 'テスト株式会社', body: '本文' },
      'gemini-3.1-flash-lite'
    )).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
