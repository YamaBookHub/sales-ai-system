import { ConflictException } from '@nestjs/common';
import { GenerateMailDraftUseCase } from './generate-mail-draft.usecase';

describe('GenerateMailDraftUseCase', () => {
  const lead = {
    id: 'lead_1',
    companyId: 'company_1',
    reason: 'SNSで商品の魅力が伝わりやすい',
    brandAnalysisMemo: null,
    snsAnalysisMemo: null,
    contactEmail: null,
    contactFormUrl: null,
    siteMessageUrl: null,
    sendMethod: 'email',
    company: { name: 'テスト株式会社', isBlocked: false, inquiryUrl: null },
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
        create: jest.fn().mockResolvedValue({ id: 'mail_1', leadId: lead.id, status: 'draft' }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([])
      },
      salesLead: {
        update: jest.fn().mockResolvedValue({ id: lead.id, status: 'drafted' })
      },
      aiGeneration: {
        create: jest.fn().mockResolvedValue({ id: 'generation_1' })
      },
      contactPerson: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'contact_1',
          email: 'primary@example.com',
          inquiryUrl: null,
          deletedAt: null,
          isUnsubscribed: false
        }),
        count: jest.fn().mockResolvedValue(1)
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1)
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
    expect(tx.outreachEmail.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        contactId: 'contact_1',
        toEmail: 'primary@example.com',
        destinationType: 'email',
        destinationValue: 'primary@example.com',
        destinationKey: 'email:primary@example.com'
      })
    }));
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

  it('does not create mail or advance the lead for a blocked company', async () => {
    const { prisma, tx } = createPrisma();
    prisma.salesLead.findUnique.mockResolvedValue({
      ...lead,
      company: { ...lead.company, isBlocked: true }
    });
    const useCase = new GenerateMailDraftUseCase(prisma as any);

    await expect(useCase.execute(lead.id, { templateKey: 'normal' }))
      .rejects.toThrow('この企業は送信禁止');

    expect(tx.outreachEmail.create).not.toHaveBeenCalled();
    expect(tx.salesLead.update).not.toHaveBeenCalled();
    expect(tx.aiGeneration.create).not.toHaveBeenCalled();
  });

  it('does not create mail or advance the lead when the same recipient has active outreach', async () => {
    const { prisma, tx } = createPrisma();
    tx.outreachEmail.findMany.mockResolvedValue([{
      status: 'sent',
      sentAt: new Date('2026-07-17T00:00:00.000Z'),
      toEmail: 'PRIMARY@EXAMPLE.COM',
      destinationType: 'email',
      destinationValue: 'primary@example.com',
      destinationKey: 'email:primary@example.com',
      contact: null,
      company: { inquiryUrl: null },
      lead: { sendMethod: 'email', contactEmail: null, contactFormUrl: null, siteMessageUrl: null }
    }]);
    const useCase = new GenerateMailDraftUseCase(prisma as any);

    await expect(useCase.execute(lead.id, { templateKey: 'normal' }))
      .rejects.toThrow('重複接触');

    expect(tx.outreachEmail.create).not.toHaveBeenCalled();
    expect(tx.salesLead.update).not.toHaveBeenCalled();
    expect(tx.aiGeneration.create).not.toHaveBeenCalled();
  });
});
