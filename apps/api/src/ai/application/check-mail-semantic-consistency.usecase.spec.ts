import { CheckMailSemanticConsistencyUseCase } from './check-mail-semantic-consistency.usecase';

describe('CheckMailSemanticConsistencyUseCase', () => {
  it('asks AI for advice without updating the mail or lead', async () => {
    const prisma = {
      outreachEmail: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'mail_1',
          body: '株式会社テスト食品 ご担当者様\n燻製サーモンの案件を拝見しました。',
          company: { name: '株式会社テスト食品' },
          lead: {
            company: { name: '株式会社テスト食品' },
            project: { title: '燻製サーモン', category: '食品', description: '燻製商品のプロジェクト' }
          },
          aiGenerations: [{ outputJson: { factsUsed: ['支援者数: 50人'] } }]
        }),
        update: jest.fn()
      }
    };
    const openAi = {
      checkSemanticConsistency: jest.fn().mockResolvedValue({
        matchesProject: true,
        suspectedForeignFacts: [],
        reason: '案件名と本文の内容が一致しています。',
        confidence: 0.92,
        model: 'gpt-test',
        latencyMs: 12
      })
    };

    const result = await new CheckMailSemanticConsistencyUseCase(prisma as any, openAi as any).execute('mail_1');

    expect(result).toMatchObject({ mailId: 'mail_1', matchesProject: true, confidence: 0.92 });
    expect(openAi.checkSemanticConsistency).toHaveBeenCalledWith(expect.objectContaining({
      companyName: '株式会社テスト食品',
      projectTitle: '燻製サーモン',
      factsUsed: ['支援者数: 50人']
    }));
    expect(prisma.outreachEmail.update).not.toHaveBeenCalled();
  });

  it('fails before calling AI when the mail does not exist', async () => {
    const prisma = { outreachEmail: { findUnique: jest.fn().mockResolvedValue(null) } };
    const openAi = { checkSemanticConsistency: jest.fn() };

    await expect(new CheckMailSemanticConsistencyUseCase(prisma as any, openAi as any).execute('missing'))
      .rejects.toThrow('Mail not found');
    expect(openAi.checkSemanticConsistency).not.toHaveBeenCalled();
  });

  it('does not update anything when the AI provider fails', async () => {
    const prisma = {
      outreachEmail: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'mail_1',
          body: '本文',
          company: { name: '株式会社テスト食品' },
          lead: { company: { name: '株式会社テスト食品' }, project: null },
          aiGenerations: []
        }),
        update: jest.fn()
      }
    };
    const openAi = { checkSemanticConsistency: jest.fn().mockRejectedValue(new Error('OpenAI unavailable')) };

    await expect(new CheckMailSemanticConsistencyUseCase(prisma as any, openAi as any).execute('mail_1'))
      .rejects.toThrow('OpenAI unavailable');
    expect(prisma.outreachEmail.update).not.toHaveBeenCalled();
  });
});
