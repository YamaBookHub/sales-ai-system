import { BadGatewayException, ConflictException } from '@nestjs/common';
import { PolishMailUseCase } from './polish-mail.usecase';

describe('PolishMailUseCase', () => {
  const email = {
    id: 'mail_1',
    leadId: 'lead_1',
    templateKey: 'normal',
    subject: '元の件名',
    body: '元の本文',
    status: 'draft',
    lead: {
      id: 'lead_1',
      reason: 'SNSで商品の魅力が伝わりやすい',
      brandAnalysisMemo: null,
      snsAnalysisMemo: null,
      company: { name: 'テスト株式会社' },
      project: {
        title: '真空保存できる米びつ',
        platform: { name: 'CAMPFIRE', type: 'campfire' },
        url: 'https://camp-fire.jp/projects/1',
        category: 'キッチン',
        description: 'お米を分けて保存できるキッチン用品',
        amount: 1000000,
        supporterCount: 100
      }
    }
  };

  const draft = {
    subject: 'CAMPFIREでのプロジェクトを拝見しご連絡いたしました',
    body: '整えた本文',
    factsUsed: ['取得元: CAMPFIRE'],
    assumptions: [],
    riskFlags: [],
    usage: { inputTokens: 10, outputTokens: 20, costUsd: 0.001 },
    model: 'gpt-test',
    latencyMs: 100,
    rawOutput: {}
  };

  const createDeps = () => {
    const tx = {
      outreachEmail: {
        update: jest.fn().mockResolvedValue({ id: email.id, status: 'draft', subject: draft.subject, body: draft.body })
      },
      aiGeneration: {
        create: jest.fn().mockResolvedValue({ id: 'generation_1' })
      }
    };
    const prisma = {
      outreachEmail: {
        findUnique: jest.fn().mockResolvedValue(email)
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const openAi = {
      createSalesMailDraft: jest.fn().mockResolvedValue(draft)
    };

    return { prisma, openAi, tx };
  };

  it('keeps polished AI mail as draft', async () => {
    const { prisma, openAi, tx } = createDeps();
    const useCase = new PolishMailUseCase(prisma as any, openAi as any);

    const result = await useCase.execute(email.id);

    expect(result.email.status).toBe('draft');
    expect(tx.outreachEmail.update).toHaveBeenCalledWith({
      where: { id: email.id },
      data: expect.objectContaining({
        subject: draft.subject,
        body: draft.body,
        status: 'draft',
        failedReason: null
      })
    });
    expect(tx.aiGeneration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: email.lead.id,
          emailId: email.id,
          provider: 'openai',
          type: 'email_draft'
        })
      })
    );
  });

  it('does not update DB when OpenAI fails', async () => {
    const { prisma, openAi } = createDeps();
    openAi.createSalesMailDraft.mockRejectedValue(new BadGatewayException('OpenAI failed'));
    const useCase = new PolishMailUseCase(prisma as any, openAi as any);

    await expect(useCase.execute(email.id)).rejects.toThrow(BadGatewayException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects non-draft mail before calling OpenAI', async () => {
    const { prisma, openAi } = createDeps();
    prisma.outreachEmail.findUnique.mockResolvedValue({ ...email, status: 'queued' });
    const useCase = new PolishMailUseCase(prisma as any, openAi as any);

    await expect(useCase.execute(email.id)).rejects.toThrow(ConflictException);
    expect(openAi.createSalesMailDraft).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
