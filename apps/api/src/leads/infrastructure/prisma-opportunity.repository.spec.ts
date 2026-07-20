import { PrismaOpportunityRepository } from './prisma-opportunity.repository';

describe('PrismaOpportunityRepository audit writes', () => {
  const actor = { userId: 'user-1', sessionId: 'session-1', organizationId: 'org-1', role: 'manager' as const };

  function opportunity(overrides: Record<string, unknown> = {}) {
    return {
      id: 'opportunity-1',
      leadId: 'lead-1',
      ownerId: null,
      stage: 'uncontacted',
      probability: 0,
      expectedAmount: null,
      wonAmount: null,
      meetingScheduledAt: null,
      expectedCloseDate: null,
      wonAt: null,
      lostAt: null,
      lossReason: null,
      lossReasonDetail: 'free text that must not be audited',
      version: 1,
      ...overrides
    };
  }

  function setup(current = opportunity(), updated = opportunity({ stage: 'contacted', probability: 10, version: 2 })) {
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      opportunity: {
        findFirst: jest.fn().mockResolvedValue(current),
        findUniqueOrThrow: jest.fn().mockResolvedValue(current),
        update: jest.fn().mockResolvedValue(updated)
      },
      opportunityStageHistory: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'history-1' }) },
      salesLead: { update: jest.fn() },
      task: { updateMany: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) }
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    return { repository: new PrismaOpportunityRepository(prisma as any), tx, prisma };
  }

  it('persists a transition audit inside the business transaction without request text', async () => {
    const { repository, tx, prisma } = setup();

    await repository.transition('lead-1', {
      expectedVersion: 1,
      operationKey: 'operation-1',
      toStage: 'contacted',
      reason: 'free text transition reason'
    }, actor);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const audit = tx.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      userId: 'user-1',
      sessionId: 'session-1',
      action: 'opportunity.transitioned',
      entityType: 'Opportunity',
      entityId: 'opportunity-1'
    });
    expect(JSON.stringify(audit)).not.toContain('free text');
    expect(JSON.stringify(audit)).not.toContain('lossReasonDetail');
  });

  it('persists a reopen audit with the authenticated session', async () => {
    const current = opportunity({ stage: 'lost', probability: 0, version: 3 });
    const updated = opportunity({ stage: 'contacted', probability: 10, version: 4 });
    const { repository, tx } = setup(current, updated);

    await repository.reopen('lead-1', {
      expectedVersion: 3,
      operationKey: 'operation-2',
      toStage: 'contacted',
      reason: 'free text reopen reason'
    }, actor);

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-1',
        action: 'opportunity.reopened',
        entityType: 'Opportunity'
      })
    });
  });
});
