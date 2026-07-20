import { CompaniesService } from './companies.service';

describe('CompaniesService', () => {
  const actor = { userId: 'user-1', sessionId: 'session-1', organizationId: 'organization-1' };

  function setup() {
    const tx = {
      company: {
        create: jest.fn().mockResolvedValue({ id: 'company-1', isBlocked: false }),
        findFirstOrThrow: jest.fn().mockResolvedValue({ isBlocked: false }),
        update: jest.fn().mockResolvedValue({ id: 'company-1', isBlocked: true }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0)
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) }
    };
    const prisma = {
      company: tx.company,
      $transaction: jest.fn((input: ((client: typeof tx) => unknown) | Promise<unknown>[]) =>
        Array.isArray(input) ? Promise.all(input) : input(tx)
      )
    };
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
    expect(tx.company.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: actor.organizationId })
    });
  });

  it('scopes list and block queries to the active organization', async () => {
    const { service, prisma, tx } = setup();
    await service.list(actor.organizationId, 1, 20);
    await service.block('company-1', {}, actor);

    expect(tx.company.findMany).toHaveBeenCalledWith({
      where: { organizationId: actor.organizationId, deletedAt: null },
      skip: 0,
      take: 20,
      orderBy: { createdAt: 'desc' }
    });

    expect(tx.company.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'company-1', organizationId: actor.organizationId, deletedAt: null },
      select: { isBlocked: true }
    });
    expect(tx.company.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId_id: { organizationId: actor.organizationId, id: 'company-1' } }
    }));
  });

  it('audits a block without persisting the block reason', async () => {
    const { service, tx } = setup();

    await service.block('company-1', { blockedReason: 'free text block reason' }, actor);

    const audit = tx.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ ...actor, action: 'company.blocked', before: { isBlocked: false } });
    expect(audit.after).toEqual({ isBlocked: true, changedFields: ['isBlocked', 'blockedReason'] });
  });
});
