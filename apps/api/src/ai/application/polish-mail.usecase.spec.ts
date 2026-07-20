import { BadGatewayException, ConflictException } from '@nestjs/common';
import { projectSourceFingerprint } from '../domain/lead-analysis';
import { PolishMailUseCase } from './polish-mail.usecase';

describe('PolishMailUseCase', () => {
  const project = {
    id: 'project_1',
    title: '真空保存できる米びつ',
    platform: { name: 'CAMPFIRE', type: 'campfire' },
    url: 'https://camp-fire.jp/projects/1',
    category: 'キッチン',
    description: 'お米を分けて保存できるキッチン用品',
    amount: 1000000,
    supporterCount: 100
  };
  const email = {
    id: 'mail_1',
    organizationId: 'org_1',
    leadId: 'lead_1',
    templateKey: 'normal',
    subject: '元の件名',
    body: '元の本文',
    status: 'draft',
    analysisRevision: {
      id: 'analysis_1',
      leadId: 'lead_1',
      projectId: project.id,
      status: 'confirmed',
      appeal: 'お米を真空で分けて保存できる点',
      targetUser: 'お米の鮮度と収納性を重視する方',
      videoIdea: '真空保存の操作と収納前後の比較',
      sourceFingerprint: projectSourceFingerprint(project)
    },
    lead: {
      id: 'lead_1',
      reason: 'SNSで商品の魅力が伝わりやすい',
      brandAnalysisMemo: null,
      snsAnalysisMemo: null,
      company: { name: 'テスト株式会社' },
      project
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
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit_1' }) }
    };
    const prisma = {
      outreachEmail: {
        findFirst: jest.fn().mockResolvedValue(email)
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const aiClient = {
      createSalesMailDraft: jest.fn().mockResolvedValue(draft)
    };

    return { prisma, aiClient, tx };
  };

  it('keeps polished AI mail as draft', async () => {
    const { prisma, aiClient, tx } = createDeps();
    const useCase = new PolishMailUseCase(prisma as any, aiClient as any);

    const result = await useCase.execute(email.id, 'gpt-5.6-sol', { userId: 'user_1', sessionId: 'session_1', organizationId: 'org_1' });

    expect(result.email.status).toBe('draft');
    expect(result.model).toBe('gpt-test');
    expect(aiClient.createSalesMailDraft).toHaveBeenCalledWith(expect.objectContaining({
      companyName: 'テスト株式会社',
      projectTitle: '真空保存できる米びつ',
      appeal: email.analysisRevision.appeal,
      targetUser: email.analysisRevision.targetUser,
      videoIdea: email.analysisRevision.videoIdea
    }), 'gpt-5.6-sol', 'org_1');
    expect(tx.outreachEmail.update).toHaveBeenCalledWith({
      where: { organizationId_id: { organizationId: 'org_1', id: email.id } },
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
          type: 'email_draft',
          inputJson: expect.objectContaining({ requestedModel: 'gpt-5.6-sol' })
        })
      })
    );
  });

  it('records Gemini as the provider when a Gemini model is used', async () => {
    const { prisma, aiClient, tx } = createDeps();
    aiClient.createSalesMailDraft.mockResolvedValue({ ...draft, model: 'gemini-3.1-flash-lite' });

    await new PolishMailUseCase(prisma as any, aiClient as any).execute(email.id, 'gemini-3.1-flash-lite', { userId: 'user_1', sessionId: 'session_1', organizationId: 'org_1' });

    expect(tx.aiGeneration.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
        promptVersion: 'v3_gemini_sales_mail_polish'
      })
    }));
  });

  it('audits a polish with the authenticated session without mail text', async () => {
    const { prisma, aiClient, tx } = createDeps();
    const actor = { userId: 'user_1', sessionId: 'session_1', organizationId: 'org_1' };

    await new PolishMailUseCase(prisma as any, aiClient as any).execute(email.id, 'gpt-5.6-sol', actor);

    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: actor.userId,
      sessionId: actor.sessionId,
      action: 'mail.polished',
      entityId: email.id
    }) });
    expect(JSON.stringify(tx.auditLog.create.mock.calls[0][0])).not.toContain(draft.body);
  });

  it('does not update DB when the selected AI provider fails', async () => {
    const { prisma, aiClient } = createDeps();
    aiClient.createSalesMailDraft.mockRejectedValue(new BadGatewayException('AI failed'));
    const useCase = new PolishMailUseCase(prisma as any, aiClient as any);

    await expect(useCase.execute(email.id, undefined, { userId: 'user_1', sessionId: 'session_1', organizationId: 'org_1' })).rejects.toThrow(BadGatewayException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects non-draft mail before calling AI', async () => {
    const { prisma, aiClient } = createDeps();
    prisma.outreachEmail.findFirst.mockResolvedValue({ ...email, status: 'queued' });
    const useCase = new PolishMailUseCase(prisma as any, aiClient as any);

    await expect(useCase.execute(email.id, undefined, { userId: 'user_1', sessionId: 'session_1', organizationId: 'org_1' })).rejects.toThrow(ConflictException);
    expect(aiClient.createSalesMailDraft).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
