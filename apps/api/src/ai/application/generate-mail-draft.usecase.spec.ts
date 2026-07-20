import { ConflictException } from '@nestjs/common';
import { projectSourceFingerprint } from '../domain/lead-analysis';
import { GenerateMailDraftUseCase } from './generate-mail-draft.usecase';

describe('GenerateMailDraftUseCase', () => {
  const actor = { userId: 'user_1', sessionId: 'session_1', organizationId: 'org_1' };
  const analysisRevisionId = '00000000-0000-4000-8000-000000000001';
  const lead = {
    id: 'lead_1',
    organizationId: 'org_1',
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
      id: 'project_1',
      title: '真空保存できる米びつ',
      platform: { name: 'CAMPFIRE', type: 'campfire' },
      url: 'https://camp-fire.jp/projects/1',
      category: 'キッチン',
      description: 'お米を分けて保存できるキッチン用品',
      amount: 1000000,
      supporterCount: 100
    }
  };
  const analysisRevision = {
    id: analysisRevisionId,
    leadId: lead.id,
    projectId: lead.project.id,
    version: 1,
    status: 'confirmed',
    appeal: 'お米を真空で分けて保存できる点',
    targetUser: 'お米の鮮度と収納性を重視する方',
    videoIdea: '真空保存の操作と収納前後の比較',
    sourceFingerprint: projectSourceFingerprint(lead.project)
  };

  const createPrisma = () => {
    const tx = {
      outreachEmail: {
        create: jest.fn().mockResolvedValue({ id: 'mail_1', leadId: lead.id, status: 'draft' }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([])
      },
      salesLead: {
        findFirst: jest.fn().mockResolvedValue(lead),
        update: jest.fn().mockResolvedValue({ id: lead.id, status: 'drafted' })
      },
      leadAnalysisRevision: {
        findFirst: jest.fn().mockResolvedValue(analysisRevision)
      },
      aiGeneration: {
        create: jest.fn().mockResolvedValue({ id: 'generation_1' })
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit_1' }) },
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
        findFirst: jest.fn().mockResolvedValue(lead)
      },
      mailTemplate: {
        findFirst: jest.fn().mockResolvedValue(null)
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

    const result = await useCase.execute(lead.id, {
      templateKey: 'normal',
      tone: 'low_sales_pressure',
      analysisRevisionId
    }, actor);

    expect(result.email.status).toBe('draft');
    expect(tx.outreachEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: lead.id,
          analysisRevisionId,
          status: 'draft',
          events: { create: { type: 'generated', payload: { actorUserId: 'user_1' } } }
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
      where: { organizationId_id: { organizationId: 'org_1', id: lead.id } },
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

  it('audits generation without copying generated mail content', async () => {
    const { prisma, tx } = createPrisma();
    const useCase = new GenerateMailDraftUseCase(prisma as any);

    await useCase.execute(lead.id, { templateKey: 'normal', analysisRevisionId }, actor);

    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      organizationId: 'org_1', userId: 'user_1', sessionId: 'session_1', action: 'mail.generated', entityId: 'mail_1'
    }) });
    const audit = JSON.stringify(tx.auditLog.create.mock.calls[0][0]);
    expect(audit).not.toContain('真空保存できる米びつを拝見');
    expect(audit).not.toContain('primary@example.com');
  });

  it('does not create another draft when the lead already has mail', async () => {
    const { prisma } = createPrisma();
    prisma.outreachEmail.findFirst.mockResolvedValue({ id: 'mail_existing', status: 'draft' });
    const useCase = new GenerateMailDraftUseCase(prisma as any);

    await expect(useCase.execute(lead.id, { templateKey: 'normal', analysisRevisionId }, actor)).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses an active email template from the database', async () => {
    const { prisma, tx } = createPrisma();
    prisma.mailTemplate.findFirst.mockResolvedValue({
      key: 'email-custom',
      channel: 'email',
      isActive: true,
      subject: '{{companyName}}様へのご提案',
      body: '{{companyName}} ご担当者様\n{{projectTitle}}を拝見しました。'
    });
    const useCase = new GenerateMailDraftUseCase(prisma as any);

    const result = await useCase.execute(lead.id, { templateKey: 'email-custom', analysisRevisionId }, actor);

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
    prisma.salesLead.findFirst.mockResolvedValue({
      ...lead,
      company: { ...lead.company, isBlocked: true }
    });
    const useCase = new GenerateMailDraftUseCase(prisma as any);

    tx.salesLead.findFirst.mockResolvedValue({
      ...lead,
      company: { ...lead.company, isBlocked: true }
    });

    await expect(useCase.execute(lead.id, { templateKey: 'normal', analysisRevisionId }, actor))
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

    await expect(useCase.execute(lead.id, { templateKey: 'normal', analysisRevisionId }, actor))
      .rejects.toThrow('重複接触');

    expect(tx.outreachEmail.create).not.toHaveBeenCalled();
    expect(tx.salesLead.update).not.toHaveBeenCalled();
    expect(tx.aiGeneration.create).not.toHaveBeenCalled();
  });

  it('rejects an unconfirmed analysis before writing mail data', async () => {
    const { prisma, tx } = createPrisma();
    tx.leadAnalysisRevision.findFirst.mockResolvedValue({ ...analysisRevision, status: 'draft' });
    const useCase = new GenerateMailDraftUseCase(prisma as any);

    await expect(useCase.execute(lead.id, { templateKey: 'normal', analysisRevisionId }, actor))
      .rejects.toThrow('確認済みの最新分析');

    expect(tx.outreachEmail.create).not.toHaveBeenCalled();
    expect(tx.salesLead.update).not.toHaveBeenCalled();
    expect(tx.aiGeneration.create).not.toHaveBeenCalled();
  });
});
