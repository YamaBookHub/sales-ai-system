import { AiUsageStatus } from '@prisma/client';
import { OpenAiBudgetService } from './openai-budget.service';

describe('OpenAiBudgetService', () => {
  const originalEnv = { ...process.env };
  const organizationId = 'org_1';

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function fixture(rows: any[] = []) {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      aiUsageLedger: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue(rows),
        create: jest.fn().mockResolvedValue({ id: 'reservation-1' })
      }
    };
    const prisma = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
      aiUsageLedger: {
        findMany: jest.fn().mockResolvedValue(rows),
        update: jest.fn().mockResolvedValue({})
      }
    };
    return { service: new OpenAiBudgetService(prisma as any), prisma, tx };
  }

  it('allows and records usage when the budget is not configured', async () => {
    delete process.env.OPENAI_MONTHLY_BUDGET_USD;
    process.env.OPENAI_ESTIMATED_COST_PER_REQUEST_USD = '0.01';
    const { service, prisma, tx } = fixture();

    await expect(service.execute(
      { organizationId, model: 'gpt-5.6-luna', operation: 'mail_polish', requestInput: {}, maxOutputTokens: 100 },
      async () => ({ usage: { costUsd: 0.004 } })
    )).resolves.toEqual({ usage: { costUsd: 0.004 } });

    expect(tx.aiUsageLedger.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId, estimatedCostUsd: 0.01, status: AiUsageStatus.reserved })
    }));
    expect(prisma.aiUsageLedger.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId_id: { organizationId, id: 'reservation-1' } },
      data: expect.objectContaining({ status: AiUsageStatus.completed, actualCostUsd: 0.004 })
    }));
  });

  it('allows an in-budget request and includes active reservations', async () => {
    process.env.OPENAI_MONTHLY_BUDGET_USD = '1';
    process.env.OPENAI_ESTIMATED_COST_PER_REQUEST_USD = '0.1';
    const { service, prisma } = fixture([
      { status: AiUsageStatus.completed, estimatedCostUsd: 0.1, actualCostUsd: 0.7 },
      { status: AiUsageStatus.reserved, estimatedCostUsd: 0.1, actualCostUsd: null }
    ]);

    await expect(service.execute(
      { organizationId, model: 'gpt-5.6-luna', operation: 'mail_polish', requestInput: {}, maxOutputTokens: 100 },
      async () => ({ usage: { costUsd: 0.05 } })
    )).resolves.toBeDefined();
  });

  it('rejects before calling OpenAI when the projected cost exceeds the budget', async () => {
    process.env.OPENAI_MONTHLY_BUDGET_USD = '1';
    process.env.OPENAI_ESTIMATED_COST_PER_REQUEST_USD = '0.11';
    const { service, tx } = fixture([
      { status: AiUsageStatus.completed, estimatedCostUsd: 0.1, actualCostUsd: 0.9 }
    ]);
    const run = jest.fn();

    await expect(service.execute(
      { organizationId, model: 'gpt-5.6-luna', operation: 'semantic_consistency', requestInput: {}, maxOutputTokens: 100 },
      run
    )).rejects.toThrow('月額予算上限');
    expect(run).not.toHaveBeenCalled();
    expect(tx.aiUsageLedger.create).not.toHaveBeenCalled();
  });

  it('releases a reservation when OpenAI fails', async () => {
    const { service, prisma } = fixture();

    await expect(service.execute(
      { organizationId, model: 'gpt-5.6-luna', operation: 'mail_polish', requestInput: {}, maxOutputTokens: 100 },
      async () => { throw new Error('provider failed'); }
    )).rejects.toThrow('provider failed');
    expect(prisma.aiUsageLedger.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: AiUsageStatus.failed, actualCostUsd: 0.01 })
    }));
  });

  it('keeps failed or uncertain usage in the monthly spend', async () => {
    process.env.OPENAI_MONTHLY_BUDGET_USD = '1';
    const { service, prisma } = fixture([
      { status: AiUsageStatus.failed, estimatedCostUsd: 0.2, actualCostUsd: null }
    ]);

    await expect(service.getUsageSummary(organizationId, new Date('2026-07-19T00:00:00Z'))).resolves.toMatchObject({
      spentUsd: 0.2,
      remainingUsd: 0.8
    });
    expect(prisma.aiUsageLedger.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId })
    }));
  });

  it('returns a Japanese usage summary', async () => {
    process.env.OPENAI_MONTHLY_BUDGET_USD = '3';
    const { service } = fixture([
      { status: AiUsageStatus.completed, estimatedCostUsd: 0.5, actualCostUsd: 1.25 }
    ]);

    await expect(service.getUsageSummary(organizationId, new Date('2026-07-19T00:00:00Z'))).resolves.toMatchObject({
      month: '2026-07',
      configured: true,
      spentUsd: 1.25,
      remainingUsd: 1.75,
      blocked: false
    });
  });
});
