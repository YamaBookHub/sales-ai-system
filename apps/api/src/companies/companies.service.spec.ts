import { CompaniesService } from './companies.service';

describe('CompaniesService', () => {
  const actor = { userId: 'user-1', sessionId: 'session-1' };

  function setup() {
    const tx = {
      company: {
        create: jest.fn().mockResolvedValue({ id: 'company-1', isBlocked: false }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ isBlocked: false }),
        update: jest.fn().mockResolvedValue({ id: 'company-1', isBlocked: true })
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) }
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    return { service: new CompaniesService(prisma as any), tx, prisma };
  }

  it('creates the company and its safe audit record in one transaction', async () => {
    const { service, prisma, tx } = setup();

    await service.create({ name: '株式会社テスト', websiteUrl: 'https://example.com', memo: 'free text' }, actor);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ...actor,
        action: 'company.created',
        entityType: 'Company',
        entityId: 'company-1',
        after: { companyId: 'company-1', isBlocked: false }
      })
    });
    expect(tx.auditLog.create.mock.calls[0][0].data.after).not.toHaveProperty('websiteUrl');
    expect(tx.auditLog.create.mock.calls[0][0].data.after).not.toHaveProperty('memo');
  });

  it('audits a block without persisting the block reason', async () => {
    const { service, tx } = setup();

    await service.block('company-1', { blockedReason: 'free text block reason' }, actor);

    const audit = tx.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ ...actor, action: 'company.blocked', before: { isBlocked: false } });
    expect(audit.after).toEqual({ isBlocked: true, changedFields: ['isBlocked', 'blockedReason'] });
  });
});
