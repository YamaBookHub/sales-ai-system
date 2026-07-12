import { ConflictException } from '@nestjs/common';
import { GenerateMailDraftUseCase } from './generate-mail-draft.usecase';

describe('GenerateMailDraftUseCase', () => {
  const lead = {
    id: 'lead_1',
    companyId: 'company_1',
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
  };

  const createPrisma = () => {
    const tx = {
      outreachEmail: {
        create: jest.fn().mockResolvedValue({ id: 'mail_1', leadId: lead.id, status: 'draft' })
      },
      salesLead: {
        update: jest.fn().mockResolvedValue({ id: lead.id, status: 'drafted' })
      },
      aiGeneration: {
        create: jest.fn().mockResolvedValue({ id: 'generation_1' })
      }
    };
    const prisma = {
      salesLead: {
        findUnique: jest.fn().mockResolvedValue(lead)
      },
      mailTemplate: {
        findUnique: jest.fn().mockResolvedValue(null)
      },
      outreachEmail: {
        findFirst: jest.fn().mockResolvedValue(null)
      },
      $transaction: jest.fn((callback) => callback(tx))
    };

    return { prisma, tx };
  };

  it('creates AI generated mail as draft only', async () => {
    const { prisma, tx } = createPrisma();
    const useCase = new GenerateMailDraftUseCase(prisma as any);

    const result = await useCase.execute(lead.id, { templateKey: 'normal', tone: 'low_sales_pressure' });

    expect(result.email.status).toBe('draft');
    expect(tx.outreachEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: lead.id,
          status: 'draft',
          events: { create: { type: 'generated' } }
        })
      })
    );
    expect(tx.salesLead.update).toHaveBeenCalledWith({
      where: { id: lead.id },
      data: { status: 'drafted' }
    });
    expect(tx.aiGeneration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: lead.id,
          emailId: 'mail_1',
          provider: 'local',
          type: 'email_draft'
        })
      })
    );
  });

  it('does not create another draft when the lead already has mail', async () => {
    const { prisma } = createPrisma();
    prisma.outreachEmail.findFirst.mockResolvedValue({ id: 'mail_existing', status: 'draft' });
    const useCase = new GenerateMailDraftUseCase(prisma as any);

    await expect(useCase.execute(lead.id, { templateKey: 'normal' })).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses an active email template from the database', async () => {
    const { prisma, tx } = createPrisma();
    prisma.mailTemplate.findUnique.mockResolvedValue({
      key: 'email-custom',
      channel: 'email',
      isActive: true,
      subject: '{{companyName}}様へのご提案',
      body: '{{companyName}} ご担当者様\n{{projectTitle}}を拝見しました。'
    });
    const useCase = new GenerateMailDraftUseCase(prisma as any);

    const result = await useCase.execute(lead.id, { templateKey: 'email-custom' });

    expect(tx.outreachEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subject: 'テスト株式会社様へのご提案',
          body: expect.stringContaining('真空保存できる米びつを拝見しました。')
        })
      })
    );
    expect(result.factsUsed).toContain('定型文: email-custom');
    expect(tx.aiGeneration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inputJson: expect.objectContaining({ template: expect.objectContaining({ key: 'email-custom' }) })
        })
      })
    );
  });
});
