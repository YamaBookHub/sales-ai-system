import { PrismaLeadRepository } from './prisma-lead.repository';

describe('PrismaLeadRepository', () => {
  it('records score and priority without overwriting manually managed dates', async () => {
    const tx = {
      leadScore: { create: jest.fn().mockResolvedValue({ id: 'score-1' }) },
      salesLead: { update: jest.fn().mockResolvedValue({ id: 'lead-1', score: 50, priority: 'medium' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) }
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    };
    const repository = new PrismaLeadRepository(prisma as any);

    await repository.recordScore('lead-1', {
      amountScore: 10,
      supporterScore: 10,
      fitScore: 20,
      urgencyScore: 10,
      activityScore: 10,
      totalScore: 50,
      reasonJson: { projectAmount: 0, supporterCount: 0, note: 'test' }
    }, 'medium');

    expect(tx.salesLead.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { score: 50, priority: 'medium' }
    });
    expect(tx.salesLead.update.mock.calls[0][0].data).not.toHaveProperty('nextActionAt');
    expect(tx.salesLead.update.mock.calls[0][0].data).not.toHaveProperty('nextFollowUpAt');
  });

  it('writes the score and a safe session audit in the same transaction', async () => {
    const tx = {
      leadScore: { create: jest.fn().mockResolvedValue({ id: 'score-1' }) },
      salesLead: { update: jest.fn().mockResolvedValue({ id: 'lead-1', score: 75, priority: 'high' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) }
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const repository = new PrismaLeadRepository(prisma as any);

    await repository.recordScore('lead-1', {
      amountScore: 20,
      supporterScore: 15,
      fitScore: 20,
      urgencyScore: 10,
      activityScore: 10,
      totalScore: 75,
      reasonJson: { projectAmount: 5000000, supporterCount: 120, note: 'do not audit' }
    }, 'high', { userId: 'user-1', sessionId: 'session-1' });

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-1',
        action: 'lead.scored',
        entityType: 'SalesLead',
        entityId: 'lead-1',
        after: expect.objectContaining({ scoreId: 'score-1', totalScore: 75, priority: 'high' })
      })
    });
    expect(JSON.stringify(tx.auditLog.create.mock.calls[0][0].data)).not.toContain('do not audit');
  });
});
