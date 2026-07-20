import { AnalyzeLeadUseCase } from './analyze-lead.usecase';

describe('AnalyzeLeadUseCase', () => {
  const actor = { userId: 'user_1', sessionId: 'session_1' };
  it('passes material engagement into the analysis input and output', async () => {
    const lead = {
      id: 'lead_1',
      reason: '資料を確認',
      company: { name: 'テスト株式会社' },
      project: {
        id: 'project_1',
        title: 'テスト商品',
        url: 'https://camp-fire.jp/projects/1',
        category: '商品',
        description: '商品説明',
        platform: { name: 'CAMPFIRE', type: 'campfire' }
      }
    };
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      salesLead: { findUnique: jest.fn().mockResolvedValue(lead) },
      aiGeneration: { create: jest.fn().mockResolvedValue({ id: 'generation_1' }) },
      leadAnalysisRevision: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'analysis_1', version: 1, status: 'draft' })
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit_1' }) }
    };
    const prisma = {
      salesLead: {
        findUnique: jest.fn().mockResolvedValue(lead)
      },
      trackedLink: {
        findMany: jest.fn().mockResolvedValue([
          {
            clicks: [
              { clickedAt: new Date('2026-07-12T04:00:00.000Z') },
              { clickedAt: new Date('2026-07-12T03:00:00.000Z') },
              { clickedAt: new Date('2026-07-12T02:00:00.000Z') }
            ]
          }
        ])
      },
      $transaction: jest.fn((callback) => callback(tx))
    };
    const useCase = new AnalyzeLeadUseCase(prisma as any);

    const result = await useCase.execute('lead_1', actor);

    expect(prisma.trackedLink.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: { leadId: 'lead_1' }, label: 'company_material' }
    }));
    expect(result.output.materialEngagement).toMatchObject({
      materialViewed: true,
      materialClickCount: 3,
      appointmentAngle: 'hot'
    });
    expect(tx.aiGeneration.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        inputJson: expect.objectContaining({
          materialEngagement: expect.objectContaining({ materialClickCount: 3 })
        })
      })
    }));
    expect(tx.leadAnalysisRevision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        leadId: 'lead_1',
        projectId: 'project_1',
        status: 'draft',
        origin: 'generated'
      })
    }));
    expect(result.analysisRevisionId).toBe('analysis_1');
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'user_1', sessionId: 'session_1', action: 'analysis.generated', entityId: 'analysis_1'
    }) });
  });
});
