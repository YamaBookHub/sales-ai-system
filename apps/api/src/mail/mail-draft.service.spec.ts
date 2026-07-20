import { ConflictException, NotFoundException } from '@nestjs/common';
import { projectSourceFingerprint } from '../ai/domain/lead-analysis';
import { MailService } from './mail.service';

describe('MailService draft creation', () => {
  const organizationId = 'org_1';
  const analysisRevisionId = '00000000-0000-4000-8000-000000000001';
  const actor = {
    userId: '11111111-1111-4111-8111-111111111111',
    sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    organizationId
  };
  const lead = {
    id: 'lead_1',
    organizationId,
    companyId: 'company_1',
    contactEmail: null,
    contactFormUrl: null,
    siteMessageUrl: null,
    sendMethod: 'email',
    company: { isBlocked: false, inquiryUrl: null },
    project: {
      id: 'project_1',
      title: 'テスト商品',
      url: 'https://camp-fire.jp/projects/1',
      category: '商品',
      description: 'テスト商品の説明',
      platform: { name: 'CAMPFIRE' }
    }
  };
  const analysisRevision = {
    id: analysisRevisionId,
    organizationId,
    leadId: lead.id,
    projectId: lead.project.id,
    status: 'confirmed',
    appeal: '商品の使いやすさが伝わる点',
    targetUser: '暮らしを便利にしたい方',
    videoIdea: '使用前後を比較する様子',
    sourceFingerprint: projectSourceFingerprint(lead.project),
    version: 1
  };

  const createService = () => {
    const tx = {
      outreachEmail: {
        create: jest.fn().mockResolvedValue({ id: 'mail_manual', leadId: lead.id, body: '手動で作成した本文', status: 'draft' }),
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
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit_1' }) },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    };
    const prisma = {
      salesLead: { findFirst: jest.fn().mockResolvedValue(lead) },
      outreachEmail: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const generatedEmail = { id: 'mail_generated', organizationId, leadId: lead.id, body: '案件固有の生成本文', status: 'draft' };
    const generateMailDraft = { execute: jest.fn().mockResolvedValue({ email: generatedEmail }) };
    const service = new MailService(
      prisma as any,
      {} as any, {} as any, {} as any, {} as any, {} as any,
      {} as any, {} as any, {} as any, {} as any,
      generateMailDraft as any,
      {} as any
    );

    return { service, prisma, tx, generateMailDraft, generatedEmail };
  };

  it('keeps the manual draft path and never saves the legacy TODO body', async () => {
    const { service, tx, generateMailDraft } = createService();

    await expect(service.createDraft({
      leadId: lead.id, analysisRevisionId, templateKey: 'normal', manualInstruction: '手動で作成した本文'
    }, actor)).resolves.toMatchObject({ id: 'mail_manual', status: 'draft' });

    expect(generateMailDraft.execute).not.toHaveBeenCalled();
    expect(tx.outreachEmail.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId,
        body: '手動で作成した本文',
        analysisRevisionId,
        contactId: 'contact_1',
        toEmail: 'primary@example.com',
        destinationType: 'email',
        destinationValue: 'primary@example.com',
        destinationKey: 'email:primary@example.com',
        status: 'draft'
      })
    }));
    expect(tx.outreachEmail.create.mock.calls[0][0].data.body)
      .not.toBe('TODO: AI-generated draft body will be inserted here.');
  });

  it('audits a successful manual draft without storing the manual body', async () => {
    const { service, tx } = createService();

    await service.createDraft({
      leadId: lead.id, analysisRevisionId, templateKey: 'normal', manualInstruction: '手動で作成した本文'
    }, actor);

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        action: 'mail.created',
        entityType: 'OutreachEmail',
        entityId: 'mail_manual',
        sessionId: actor.sessionId
      })
    });
    expect(JSON.stringify(tx.auditLog.create.mock.calls[0][0])).not.toContain('手動で作成した本文');
  });

  it('returns only the generated OutreachEmail when manual instruction is omitted', async () => {
    const { service, prisma, generateMailDraft, generatedEmail } = createService();

    await expect(service.createDraft({
      leadId: lead.id, analysisRevisionId, templateKey: 'normal'
    }, actor)).resolves.toBe(generatedEmail);

    expect(generateMailDraft.execute).toHaveBeenCalledWith(
      lead.id, { templateKey: 'normal', analysisRevisionId }, actor
    );
    expect(prisma.salesLead.findFirst).not.toHaveBeenCalled();
  });

  it('uses the generated draft path for an empty manual instruction', async () => {
    const { service, generateMailDraft } = createService();

    await service.createDraft({
      leadId: lead.id, analysisRevisionId, templateKey: 'normal', manualInstruction: ''
    }, actor);

    expect(generateMailDraft.execute).toHaveBeenCalledWith(
      lead.id, { templateKey: 'normal', analysisRevisionId }, actor
    );
  });

  it('uses the generated draft path for a whitespace-only manual instruction', async () => {
    const { service, generateMailDraft } = createService();

    await service.createDraft({
      leadId: lead.id, analysisRevisionId, templateKey: 'normal', manualInstruction: '  \n  '
    }, actor);

    expect(generateMailDraft.execute).toHaveBeenCalledWith(
      lead.id, { templateKey: 'normal', analysisRevisionId }, actor
    );
  });

  it('keeps the lead not found behavior for manual drafts', async () => {
    const { service, prisma, generateMailDraft } = createService();
    prisma.salesLead.findFirst.mockResolvedValue(null);

    await expect(service.createDraft({
      leadId: lead.id, analysisRevisionId, templateKey: 'normal', manualInstruction: '手動本文'
    }, actor)).rejects.toThrow(NotFoundException);

    expect(generateMailDraft.execute).not.toHaveBeenCalled();
  });

  it('keeps the existing mail conflict behavior for manual drafts', async () => {
    const { service, prisma, generateMailDraft } = createService();
    prisma.outreachEmail.findFirst.mockResolvedValue({ id: 'mail_existing', organizationId });

    await expect(service.createDraft({
      leadId: lead.id, analysisRevisionId, templateKey: 'normal', manualInstruction: '手動本文'
    }, actor)).rejects.toThrow(ConflictException);

    expect(generateMailDraft.execute).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not disclose a lead outside the current organization', async () => {
    const { service, prisma } = createService();
    prisma.salesLead.findFirst.mockResolvedValue(null);

    await expect(service.createDraft({
      leadId: 'lead_other', analysisRevisionId, templateKey: 'normal', manualInstruction: '本文'
    }, actor)).rejects.toThrow(NotFoundException);
    expect(prisma.salesLead.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'lead_other', organizationId }
    }));
  });
});
