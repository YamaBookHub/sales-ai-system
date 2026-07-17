import { PrismaLeadRepository } from './prisma-lead.repository';

describe('PrismaLeadRepository', () => {
  it('records score and priority without overwriting manually managed dates', async () => {
    const tx = {
      leadScore: { create: jest.fn().mockResolvedValue({ id: 'score-1' }) },
      salesLead: { update: jest.fn().mockResolvedValue({ id: 'lead-1' }) }
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
});
