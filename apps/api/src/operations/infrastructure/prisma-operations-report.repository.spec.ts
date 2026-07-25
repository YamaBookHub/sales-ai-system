import { PrismaOperationsReportRepository } from './prisma-operations-report.repository';
import { resolveOperationsPeriod } from '../domain/operations-report';

describe('PrismaOperationsReportRepository', () => {
  const organizationId = 'org_1';

  function createPrisma() {
    return {
      aiUsageLedger: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0)
      },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
      projectSearchJob: { findMany: jest.fn().mockResolvedValue([]) },
      emailReply: { groupBy: jest.fn().mockResolvedValue([]) },
      outreachEmail: {
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0)
      }
    };
  }

  it('uses organization-scoped, aggregate-only selects and exposes no PII fields', async () => {
    const prisma = createPrisma();
    const repository = new PrismaOperationsReportRepository(prisma as any);
    const period = resolveOperationsPeriod({ from: '2026-07-01', to: '2026-07-02' }, new Date('2026-07-02T12:00:00.000Z'));

    await expect(repository.summarize(organizationId, period)).resolves.toEqual({
      aiRows: [], terminalSearches: [], runningSearches: [], imports: [], replies: [], mails: [],
      stuckSendingCount: 0, staleReservedAiCount: 0
    });

    expect(prisma.aiUsageLedger.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId }),
      select: { status: true, estimatedCostUsd: true, actualCostUsd: true }
    }));
    expect(prisma.projectSearchJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId,
        status: 'running',
        leaseExpiresAt: { gt: expect.any(Date) },
        expiresAt: { gt: expect.any(Date) }
      }),
      select: { source: true }
    }));
    expect(prisma.projectSearchJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId,
        status: 'running',
        leaseExpiresAt: { gte: expect.any(Date), lte: expect.any(Date) }
      }),
      select: { id: true, source: true, startedAt: true, leaseExpiresAt: true }
    }));
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId, action: 'projects.search_finished' }),
      orderBy: { createdAt: 'asc' },
      select: { entityId: true, after: true }
    }));
    expect(prisma.auditLog.findMany.mock.calls[1][0]).toEqual(expect.objectContaining({
      where: expect.objectContaining({ organizationId, action: { in: ['projects.import', 'projects.import_failed', 'projects.bulk_import'] } }),
      select: { action: true, after: true }
    }));
    const serializedQueryInputs = JSON.stringify([
      prisma.aiUsageLedger.findMany.mock.calls[0][0],
      prisma.projectSearchJob.findMany.mock.calls[0][0],
      ...prisma.auditLog.findMany.mock.calls.map((call: unknown[]) => call[0])
    ]);
    expect(serializedQueryInputs).not.toContain('email');
    expect(serializedQueryInputs).not.toContain('body');
    expect(serializedQueryInputs).not.toContain('url');
    expect(serializedQueryInputs).not.toContain('prompt');
  });

  it('parses only allowlisted safe audit fields into aggregates', async () => {
    const prisma = createPrisma();
    prisma.auditLog.findMany
      .mockResolvedValueOnce([{ entityId: 'job_1', after: {
        source: 'campfire', status: 'completed', durationMs: 120, itemCount: 3, importableCount: 2, completionReason: 'desired_reached', message: 'ignore', url: 'https://private.test'
      } }])
      .mockResolvedValueOnce([
        { action: 'projects.import', after: { source: 'campfire', projectId: 'id-only' } },
        { action: 'projects.import_failed', after: { source: 'makuake', status: 'failed', error: 'private' } },
        { action: 'projects.bulk_import', after: { source: 'campfire', requested: 3, imported: 2, failed: 1, analysisFailed: 1, message: 'private' } }
      ]);
    prisma.aiUsageLedger.findMany.mockResolvedValue([{ status: 'completed', estimatedCostUsd: 0.1, actualCostUsd: 0.02 }]);
    prisma.emailReply.groupBy.mockResolvedValue([{ category: 'interested', _count: { _all: 2 } }]);
    prisma.outreachEmail.groupBy.mockResolvedValue([{ status: 'failed', _count: { _all: 1 } }]);
    const repository = new PrismaOperationsReportRepository(prisma as any);
    const data = await repository.summarize(organizationId, resolveOperationsPeriod({}, new Date('2026-07-25T00:00:00.000Z')));

    expect(data).toEqual(expect.objectContaining({
      terminalSearches: [{ jobId: 'job_1', source: 'campfire', status: 'completed', durationMs: 120 }],
      imports: [
        { action: 'projects.import', source: 'campfire', requested: 1, imported: 1, failed: 0, analysisFailed: 0 },
        { action: 'projects.import_failed', source: 'makuake', requested: 1, imported: 0, failed: 1, analysisFailed: 0 },
        { action: 'projects.bulk_import', source: 'campfire', requested: 3, imported: 2, failed: 1, analysisFailed: 1 }
      ],
      replies: [{ category: 'interested', count: 2 }],
      mails: [{ status: 'failed', count: 1 }]
    }));
    expect(JSON.stringify(data)).not.toContain('private');
    expect(JSON.stringify(data)).not.toContain('https://');
  });

  it('counts a terminal search job once when a retry produced duplicate audit rows', async () => {
    const prisma = createPrisma();
    prisma.auditLog.findMany
      .mockResolvedValueOnce([
        { entityId: 'job_1', after: { source: 'campfire', status: 'completed', durationMs: 120 } },
        { entityId: 'job_1', after: { source: 'campfire', status: 'completed', durationMs: 120 } }
      ])
      .mockResolvedValueOnce([]);
    const repository = new PrismaOperationsReportRepository(prisma as any);

    const data = await repository.summarize(
      organizationId,
      resolveOperationsPeriod({}, new Date('2026-07-25T00:00:00.000Z'))
    );

    expect(data.terminalSearches).toEqual([
      { jobId: 'job_1', source: 'campfire', status: 'completed', durationMs: 120 }
    ]);
  });

  it('treats a lease-expired job as failed instead of currently running', async () => {
    const prisma = createPrisma();
    prisma.projectSearchJob.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'job_stale',
        source: 'makuake',
        startedAt: new Date('2026-07-25T00:00:00.000Z'),
        leaseExpiresAt: new Date('2026-07-25T00:00:15.000Z')
      }]);
    const repository = new PrismaOperationsReportRepository(prisma as any);

    const data = await repository.summarize(
      organizationId,
      resolveOperationsPeriod({}, new Date('2026-07-25T01:00:00.000Z'))
    );

    expect(data.runningSearches).toEqual([]);
    expect(data.terminalSearches).toEqual([
      { jobId: 'job_stale', source: 'makuake', status: 'failed', durationMs: 15_000 }
    ]);
  });
});
