import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  it('creates a manual project and its safe audit record in one transaction', async () => {
    const project = {
      id: 'project_1',
      platformId: 'platform_1',
      companyId: 'company_1',
      status: 'active',
      amount: 1000,
      supporterCount: 2,
      category: 'プロダクト'
    };
    const tx = {
      company: { findFirst: jest.fn().mockResolvedValue({ id: 'company_1' }) },
      crowdfundingProject: { create: jest.fn().mockResolvedValue(project) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit_1' }) }
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new ProjectsService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    await service.create({
      platformId: project.platformId,
      companyId: project.companyId,
      title: '外部に出してはいけない案件名',
      url: 'https://example.test/project?access_token=secret',
      status: 'active' as any,
      amount: project.amount,
      supporterCount: project.supporterCount,
      category: project.category
    }, { userId: 'user_1', sessionId: 'session_1', organizationId: 'organization_1' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'user_1',
      sessionId: 'session_1',
      organizationId: 'organization_1',
      action: 'project.created',
      entityId: project.id
    }) });
    const audit = JSON.stringify(tx.auditLog.create.mock.calls[0][0]);
    expect(audit).not.toContain('外部に出してはいけない案件名');
    expect(audit).not.toContain('access_token=secret');
    expect(tx.crowdfundingProject.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'organization_1' })
    });
    expect(tx.company.findFirst).toHaveBeenCalledWith({
      where: { id: project.companyId, organizationId: 'organization_1', deletedAt: null },
      select: { id: true }
    });
  });
});
