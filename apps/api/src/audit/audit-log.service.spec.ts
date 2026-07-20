import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  const prisma = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    $transaction: jest.fn()
  };
  const service = new AuditLogService(prisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('records only supplied safe audit metadata', async () => {
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    await service.record({
      userId: 'user-1',
      sessionId: 'session-1',
      action: 'lead.updated',
      entityType: 'SalesLead',
      entityId: 'lead-1',
      after: { method: 'PATCH', changedFields: ['priority'], status: 200 }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-1',
        action: 'lead.updated',
        entityType: 'SalesLead',
        entityId: 'lead-1',
        after: { method: 'PATCH', changedFields: ['priority'], status: 200 }
      })
    });
  });

  it('redacts sensitive metadata before recording it', async () => {
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    await service.record({
      userId: 'user-1',
      action: 'opportunity.updated',
      entityType: 'Opportunity',
      entityId: 'opportunity-1',
      after: {
        status: 'lost',
        lossReasonDetail: '取引先固有の失注理由',
        summary: '顧客との会話要約',
        projectUrl: 'https://example.com/private'
      }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        after: {
          status: 'lost',
          lossReasonDetail: '[redacted]',
          summary: '[redacted]',
          projectUrl: '[redacted]'
        }
      })
    });
  });

  it('paginates a filtered audit list with a bounded limit', async () => {
    prisma.$transaction.mockResolvedValue([[
      {
        id: 'audit-2',
        before: { status: 'draft', ownerMemo: '社外秘', contactEmail: 'person@example.com', lossReasonDetail: '顧客固有の事情' },
        after: { status: 'approved', projectUrl: 'https://example.com/private', changedFields: ['status'] }
      }
    ], 1]);
    const result = await service.list(0, 1000, { action: 'mail.approved', entityId: 'mail-1' });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { action: 'mail.approved', entityId: 'mail-1' },
      skip: 0,
      take: 100
    }));
    expect(result).toEqual({
      items: [{
        id: 'audit-2',
        before: { status: 'draft', ownerMemo: '[redacted]', contactEmail: '[redacted]', lossReasonDetail: '[redacted]' },
        after: { status: 'approved', projectUrl: '[redacted]', changedFields: ['status'] }
      }],
      page: 1,
      limit: 100,
      total: 1
    });
  });
});
