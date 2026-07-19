import { AiClientService } from './ai-client.service';

describe('AiClientService', () => {
  it('routes Gemini and OpenAI model requests to the matching provider', async () => {
    const gemini = {
      createSalesMailDraft: jest.fn().mockResolvedValue({ model: 'gemini-3.1-flash-lite' }),
      checkSemanticConsistency: jest.fn()
    };
    const openAi = {
      assertConfigured: jest.fn(),
      createSalesMailDraft: jest.fn().mockResolvedValue({ model: 'gpt-5.6-sol' }),
      checkSemanticConsistency: jest.fn()
    };
    const openAiBudget = {
      execute: jest.fn(async (_input, run) => run())
    };
    const client = new AiClientService(gemini as any, openAi as any, openAiBudget as any);
    const input = { templateKey: 'normal', companyName: 'テスト株式会社' };

    await client.createSalesMailDraft(input, 'gemini-3.1-flash-lite');
    await client.createSalesMailDraft(input, 'gpt-4.1-mini');
    await client.createSalesMailDraft(input, 'gpt-5.6-sol');

    expect(gemini.createSalesMailDraft).toHaveBeenCalledWith(input, 'gemini-3.1-flash-lite');
    expect(openAi.createSalesMailDraft).toHaveBeenCalledWith(input, 'gpt-4.1-mini');
    expect(openAi.createSalesMailDraft).toHaveBeenCalledWith(input, 'gpt-5.6-sol');
    expect(openAiBudget.execute).toHaveBeenCalledTimes(2);
  });

  it('does not apply the OpenAI budget to Gemini requests', async () => {
    const gemini = {
      createSalesMailDraft: jest.fn(),
      checkSemanticConsistency: jest.fn().mockResolvedValue({ model: 'gemini-3.1-flash-lite' })
    };
    const openAiBudget = { execute: jest.fn() };
    const client = new AiClientService(gemini as any, {} as any, openAiBudget as any);

    await client.checkSemanticConsistency({ companyName: '会社', body: '本文' }, 'gemini-3.1-flash-lite');

    expect(gemini.checkSemanticConsistency).toHaveBeenCalled();
    expect(openAiBudget.execute).not.toHaveBeenCalled();
  });
});
