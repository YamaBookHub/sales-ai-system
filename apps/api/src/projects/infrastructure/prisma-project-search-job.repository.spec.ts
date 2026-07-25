import { PrismaProjectSearchJobRepository } from './prisma-project-search-job.repository';
import { StoredProjectSearchJob } from '../domain/project-search-job';

describe('PrismaProjectSearchJobRepository', () => {
  const now = new Date('2026-07-21T00:00:00.000Z');
  const leaseExpiresAt = new Date('2026-07-21T00:00:15.000Z');
  const expiresAt = new Date('2026-07-21T00:30:00.000Z');

  function jobRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'job-1',
      organizationId: 'organization-1',
      ownerUserId: 'user-1',
      workerId: 'worker-1',
      status: 'running',
      source: 'campfire',
      request: { keyword: '食品' },
      desiredLimit: 10,
      searchedLimit: 5,
      items: [{ title: '商品', url: 'https://example.test/projects/1' }],
      itemCount: 1,
      importableCount: 1,
      diagnostics: { sourceCandidateCount: 5, conditionMatchedCount: 2, excludedCount: 1, scanComplete: false },
      completionReason: null,
      message: '候補を取得中です',
      cancelRequestedAt: null,
      leaseExpiresAt,
      expiresAt,
      startedAt: now,
      updatedAt: now,
      ...overrides
    };
  }

  function storedJob(overrides: Partial<StoredProjectSearchJob> = {}): StoredProjectSearchJob {
    return {
      ...jobRow(),
      status: 'running',
      source: 'campfire',
      cancelRequestedAt: undefined,
      diagnostics: { sourceCandidateCount: 5, conditionMatchedCount: 2, excludedCount: 1, scanComplete: false },
      ...overrides
    } as StoredProjectSearchJob;
  }

  it('cancels an older running job and creates a replacement under the same owner lock', async () => {
    const oldExpiry = new Date('2026-07-21T00:45:00.000Z');
    const superseded = {
      id: 'old-job',
      source: 'campfire',
      startedAt: new Date('2026-07-20T23:59:00.000Z'),
      itemCount: 4,
      importableCount: 3,
      expiresAt: oldExpiry
    };
    const tx = {
      auditLog: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $executeRawUnsafe: jest.fn(),
      projectSearchJob: {
        findMany: jest.fn().mockResolvedValue([superseded]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue(jobRow())
      }
    };
    const prisma = { $transaction: jest.fn(async (callback) => callback(tx)) };
    const repository = new PrismaProjectSearchJobRepository(prisma as any);

    const result = await repository.create(storedJob());

    expect(result).toMatchObject({ id: 'job-1', status: 'running', request: { keyword: '食品' } });
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      'project-search-job:organization-1:user-1'
    );
    expect(tx.projectSearchJob.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'organization-1', ownerUserId: 'user-1', status: 'running' },
      select: {
        id: true,
        source: true,
        startedAt: true,
        itemCount: true,
        importableCount: true,
        expiresAt: true
      }
    });
    expect(tx.projectSearchJob.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'organization-1', ownerUserId: 'user-1', status: 'running' },
      data: expect.objectContaining({
        status: 'cancelled',
        cancelRequestedAt: now,
        completionReason: 'cancelled',
        message: '新しい検索ジョブを開始したため停止しました',
        expiresAt: oldExpiry
      })
    });
    expect(tx.projectSearchJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'organization-1',
        ownerUserId: 'user-1',
        workerId: 'worker-1',
        status: 'running',
        source: 'campfire',
        items: [{ title: '商品', url: 'https://example.test/projects/1' }]
      })
    });
    expect(tx.auditLog.createMany).toHaveBeenCalledWith({
      data: [{
        organizationId: 'organization-1',
        userId: 'user-1',
        action: 'projects.search_finished',
        entityType: 'ProjectSearchJob',
        entityId: 'old-job',
        createdAt: now,
        after: {
          source: 'campfire',
          status: 'cancelled',
          durationMs: 60_000,
          itemCount: 4,
          importableCount: 3,
          completionReason: 'cancelled'
        }
      }]
    });
  });

  it('hides jobs that do not belong to the owner or have expired', async () => {
    const prisma = { projectSearchJob: { findFirst: jest.fn().mockResolvedValue(jobRow()) } };
    const repository = new PrismaProjectSearchJobRepository(prisma as any);

    await expect(repository.findOwned('job-1', 'organization-1', 'user-1', now)).resolves.toMatchObject({ id: 'job-1' });

    expect(prisma.projectSearchJob.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'job-1',
        organizationId: 'organization-1',
        ownerUserId: 'user-1',
        expiresAt: { gt: now }
      }
    });
  });

  it('returns control only to the worker that owns the job', async () => {
    const prisma = {
      projectSearchJob: {
        findFirst: jest.fn().mockResolvedValue({ status: 'running', cancelRequestedAt: null, leaseExpiresAt })
      }
    };
    const repository = new PrismaProjectSearchJobRepository(prisma as any);

    await expect(repository.findWorkerControl('job-1', 'worker-1')).resolves.toEqual({
      status: 'running',
      cancelRequestedAt: undefined,
      leaseExpiresAt
    });
    expect(prisma.projectSearchJob.findFirst).toHaveBeenCalledWith({
      where: { id: 'job-1', workerId: 'worker-1' },
      select: { status: true, cancelRequestedAt: true, leaseExpiresAt: true }
    });
  });

  it('updates progress only while the worker lease is active and cancellation was not requested', async () => {
    const prisma = { projectSearchJob: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const repository = new PrismaProjectSearchJobRepository(prisma as any);
    const nextLease = new Date('2026-07-21T00:00:30.000Z');
    const nextExpiry = new Date('2026-07-21T00:31:00.000Z');

    await expect(repository.updateProgress('job-1', 'worker-1', {
      searchedLimit: 20,
      items: [{ title: '更新後', url: 'https://example.test/projects/2' }],
      itemCount: 1,
      importableCount: 1,
      diagnostics: { sourceCandidateCount: 20, conditionMatchedCount: 1, excludedCount: 0, scanComplete: false },
      message: '取得中'
    }, nextLease, nextExpiry)).resolves.toBe(true);

    expect(prisma.projectSearchJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'job-1',
        workerId: 'worker-1',
        status: 'running',
        cancelRequestedAt: null,
        leaseExpiresAt: expect.objectContaining({ gt: expect.any(Date) }),
        expiresAt: expect.objectContaining({ gt: expect.any(Date) })
      }),
      data: expect.objectContaining({ searchedLimit: 20, message: '取得中', leaseExpiresAt: nextLease, expiresAt: nextExpiry })
    }));
  });

  it('uses the same active worker condition for heartbeat and terminal completion', async () => {
    const prisma = { projectSearchJob: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const repository = new PrismaProjectSearchJobRepository(prisma as any);
    const nextLease = new Date('2026-07-21T00:00:30.000Z');
    const nextExpiry = new Date('2026-07-21T00:31:00.000Z');

    await expect(repository.heartbeat('job-1', 'worker-1', nextLease, nextExpiry)).resolves.toBe(true);
    await expect(repository.finish('job-1', 'worker-1', {
      status: 'completed',
      items: [],
      itemCount: 0,
      importableCount: 0,
      message: '完了',
      completionReason: 'source_exhausted'
    }, nextExpiry)).resolves.toBe(true);

    const [heartbeatCall, finishCall] = prisma.projectSearchJob.updateMany.mock.calls;
    expect(heartbeatCall[0].where).toEqual(expect.objectContaining({ status: 'running', cancelRequestedAt: null }));
    expect(finishCall[0]).toEqual(expect.objectContaining({
      where: expect.objectContaining({ status: 'running', cancelRequestedAt: null }),
      data: expect.objectContaining({ status: 'completed', completionReason: 'source_exhausted', message: '完了' })
    }));
  });

  it('cancels a job atomically for its owner and returns the cancelled record', async () => {
    const cancelled = jobRow({ status: 'cancelled', cancelRequestedAt: now, completionReason: 'cancelled', message: '停止しました' });
    const tx = {
      projectSearchJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(cancelled)
      }
    };
    const prisma = { $transaction: jest.fn(async (callback) => callback(tx)) };
    const repository = new PrismaProjectSearchJobRepository(prisma as any);

    await expect(repository.requestCancel('job-1', 'organization-1', 'user-1', '停止しました', now, expiresAt))
      .resolves.toMatchObject({ status: 'cancelled', completionReason: 'cancelled' });

    expect(tx.projectSearchJob.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'job-1', organizationId: 'organization-1', ownerUserId: 'user-1', status: 'running', expiresAt: { gt: now }
      },
      data: {
        status: 'cancelled', cancelRequestedAt: now, completionReason: 'cancelled', message: '停止しました', leaseExpiresAt: now, expiresAt
      }
    });
    expect(tx.projectSearchJob.findFirst).toHaveBeenCalledWith({
      where: { id: 'job-1', organizationId: 'organization-1', ownerUserId: 'user-1', expiresAt: { gt: now } }
    });
  });

  it.each(['cancelled', 'completed'] as const)(
    'returns the current %s job when a repeated cancel no longer updates a running row',
    async (status) => {
      const current = jobRow({ status, cancelRequestedAt: status === 'cancelled' ? now : null });
      const tx = {
        projectSearchJob: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findFirst: jest.fn().mockResolvedValue(current)
        }
      };
      const prisma = { $transaction: jest.fn(async (callback) => callback(tx)) };
      const repository = new PrismaProjectSearchJobRepository(prisma as any);

      await expect(repository.requestCancel('job-1', 'organization-1', 'user-1', '停止しました', now, expiresAt))
        .resolves.toMatchObject({ status });
    }
  );

  it('returns the current job when a heartbeat renews the lease before lease failure can claim it', async () => {
    const renewed = jobRow({ leaseExpiresAt: new Date('2026-07-21T00:01:00.000Z') });
    const tx = {
      projectSearchJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(renewed)
      }
    };
    const prisma = { $transaction: jest.fn(async (callback) => callback(tx)) };
    const repository = new PrismaProjectSearchJobRepository(prisma as any);

    await expect(repository.failExpiredLease('job-1', 'organization-1', 'user-1', now, 'workerが停止しました', expiresAt))
      .resolves.toMatchObject({ status: 'running', leaseExpiresAt: renewed.leaseExpiresAt });
  });

  it('fails only an un-cancelled job whose lease expired, then deletes expired TTL rows', async () => {
    const failed = jobRow({ status: 'failed', completionReason: 'failed', message: 'workerが停止しました' });
    const tx = {
      auditLog: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      projectSearchJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(failed),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 3 })
      }
    };
    const prisma = { $transaction: jest.fn(async (callback) => callback(tx)) };
    const repository = new PrismaProjectSearchJobRepository(prisma as any);

    await expect(repository.failExpiredLease('job-1', 'organization-1', 'user-1', now, 'workerが停止しました', expiresAt))
      .resolves.toMatchObject({ status: 'failed', completionReason: 'failed' });
    await expect(repository.deleteExpired(now)).resolves.toBe(3);

    expect(tx.projectSearchJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'running', cancelRequestedAt: null, leaseExpiresAt: { lte: now }, expiresAt: { gt: now }
      }),
      data: expect.objectContaining({ status: 'failed', completionReason: 'failed', message: 'workerが停止しました' })
    }));
    expect(tx.projectSearchJob.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lte: now } } });
  });

  it('records an abandoned running job before deleting its expired row', async () => {
    const abandoned = {
      id: 'job-abandoned',
      organizationId: 'organization-1',
      ownerUserId: 'user-1',
      source: 'makuake',
      startedAt: new Date('2026-07-20T23:59:00.000Z'),
      leaseExpiresAt: now,
      itemCount: 2,
      importableCount: 1
    };
    const tx = {
      auditLog: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      projectSearchJob: {
        findMany: jest.fn().mockResolvedValue([abandoned]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 })
      }
    };
    const repository = new PrismaProjectSearchJobRepository({
      $transaction: jest.fn(async (callback) => callback(tx))
    } as any);

    await expect(repository.deleteExpired(now)).resolves.toBe(1);

    expect(tx.auditLog.createMany).toHaveBeenCalledWith({
      data: [{
        organizationId: 'organization-1',
        userId: 'user-1',
        action: 'projects.search_finished',
        entityType: 'ProjectSearchJob',
        entityId: 'job-abandoned',
        createdAt: now,
        after: {
          source: 'makuake',
          status: 'failed',
          durationMs: 60_000,
          itemCount: 2,
          importableCount: 1,
          completionReason: 'failed'
        }
      }]
    });
  });
});
