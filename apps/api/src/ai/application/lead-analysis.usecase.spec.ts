import { projectSourceFingerprint } from '../domain/lead-analysis';
import { LeadAnalysisUseCase } from './lead-analysis.usecase';

describe('LeadAnalysisUseCase audit actor', () => {
  it('stores the authenticated session for confirmed analysis without its free-form values', async () => {
    const project = {
      id: 'project_1',
      title: '案件名',
      url: 'https://example.test/project',
      category: 'プロダクト',
      description: '案件の説明'
    };
    const sourceFingerprint = projectSourceFingerprint(project);
    const revision = {
      id: 'analysis_1',
      leadId: 'lead_1',
      projectId: project.id,
      version: 1,
      status: 'confirmed',
      appeal: '入力した商品の魅力',
      targetUser: '入力した使う人',
      videoIdea: '入力した動画案',
      sourceFingerprint,
      humanEdited: true,
      editedFields: ['appeal'],
      origin: 'manual'
    };
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      salesLead: { findUnique: jest.fn().mockResolvedValue({ id: 'lead_1', project }) },
      leadAnalysisRevision: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(revision)
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit_1' }) }
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
      salesLead: { findUnique: jest.fn().mockResolvedValue({ id: 'lead_1', project }) },
      leadAnalysisRevision: {
        findMany: jest.fn().mockResolvedValue([revision]),
        findFirst: jest.fn().mockResolvedValue(revision)
      }
    };

    await new LeadAnalysisUseCase(prisma as any).confirm('lead_1', {
      expectedVersion: 0,
      expectedSourceFingerprint: sourceFingerprint,
      appeal: revision.appeal,
      targetUser: revision.targetUser,
      videoIdea: revision.videoIdea
    }, { userId: 'user_1', sessionId: 'session_1' });

    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'user_1',
      sessionId: 'session_1',
      action: 'analysis.confirmed',
      entityId: revision.id
    }) });
    const audit = JSON.stringify(tx.auditLog.create.mock.calls[0][0]);
    expect(audit).not.toContain(revision.appeal);
    expect(audit).not.toContain(revision.targetUser);
    expect(audit).not.toContain(revision.videoIdea);
  });
});
