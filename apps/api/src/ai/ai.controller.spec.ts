import { AiController } from './ai.controller';

describe('AiController audit actor propagation', () => {
  const principal = {
    userId: 'user_1',
    sessionId: 'session_1',
    organizationId: 'org_1',
    organizationSlug: 'org-1',
    role: 'operator' as const,
    email: 'operator@example.test'
  };
  const actor = { userId: principal.userId, sessionId: principal.sessionId, organizationId: principal.organizationId };

  it('passes the authenticated actor to every AI operation that writes audited data', async () => {
    const service = {
      generateMailDraft: jest.fn().mockResolvedValue({}),
      analyzeLead: jest.fn().mockResolvedValue({}),
      saveLeadAnalysis: jest.fn().mockResolvedValue({}),
      confirmLeadAnalysis: jest.fn().mockResolvedValue({}),
      polishMail: jest.fn().mockResolvedValue({}),
      classifyReply: jest.fn().mockResolvedValue({}),
      getLeadAnalysis: jest.fn().mockResolvedValue({}),
      checkMailSemanticConsistency: jest.fn().mockResolvedValue({}),
      listLeadGenerations: jest.fn().mockResolvedValue({}),
      getOpenAiUsageSummary: jest.fn().mockResolvedValue({})
    };
    const controller = new AiController(service as any);
    const analysisDto = { expectedVersion: 0, expectedSourceFingerprint: 'fingerprint' } as any;

    await controller.generateMailDraft('lead_1', { templateKey: 'normal' } as any, principal);
    await controller.generateMailDraftAlias('lead_1', { templateKey: 'normal' } as any, principal);
    await controller.analyzeLead('lead_1', principal);
    await controller.saveLeadAnalysis('lead_1', analysisDto, principal);
    await controller.confirmLeadAnalysis('lead_1', analysisDto, principal);
    await controller.polishMail('mail_1', { model: 'gpt-5.6-sol' } as any, principal);
    await controller.classifyReply('reply_1', principal);
    await controller.getLeadAnalysis('lead_1', principal);
    await controller.checkMailSemanticConsistency('mail_1', { model: 'gpt-5.6-sol' } as any, principal);
    await controller.listLeadGenerations('lead_1', principal);
    await controller.getUsageSummary(principal);

    expect(service.generateMailDraft).toHaveBeenNthCalledWith(1, 'lead_1', { templateKey: 'normal' }, actor);
    expect(service.generateMailDraft).toHaveBeenNthCalledWith(2, 'lead_1', { templateKey: 'normal' }, actor);
    expect(service.analyzeLead).toHaveBeenCalledWith('lead_1', actor);
    expect(service.saveLeadAnalysis).toHaveBeenCalledWith('lead_1', analysisDto, actor);
    expect(service.confirmLeadAnalysis).toHaveBeenCalledWith('lead_1', analysisDto, actor);
    expect(service.polishMail).toHaveBeenCalledWith('mail_1', 'gpt-5.6-sol', actor);
    expect(service.classifyReply).toHaveBeenCalledWith('reply_1', actor);
    expect(service.getLeadAnalysis).toHaveBeenCalledWith('lead_1', actor);
    expect(service.checkMailSemanticConsistency).toHaveBeenCalledWith('mail_1', 'gpt-5.6-sol', actor);
    expect(service.listLeadGenerations).toHaveBeenCalledWith('lead_1', actor);
    expect(service.getOpenAiUsageSummary).toHaveBeenCalledWith(actor);
  });
});
