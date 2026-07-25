import { NotFoundException } from '@nestjs/common';
import {
  ProjectSearchJobControl,
  ProjectSearchJobProgress,
  ProjectSearchJobRepository,
  ProjectSearchJobTerminalUpdate,
  StoredProjectSearchJob
} from '../domain/project-search-job';
import { ProjectSourceSearchError } from '../domain/project-source-provider';
import { ProjectSearchJobManager } from './project-search-job.manager';

describe('ProjectSearchJobManager', () => {
  const organizationId = 'organization-1';
  const ownerUserId = 'user-1';
  const provider = { source: 'campfire', baseUrl: 'https://camp-fire.jp' } as any;
  const diagnostics = {
    sourceCandidateCount: 10,
    conditionMatchedCount: 10,
    excludedCount: 0,
    scanComplete: true
  };

  function createManager(repository = new InMemorySearchJobRepository(), existingUrls: string[] = []) {
    const logger = { errorEvent: jest.fn() };
    const operationsAudit = { recordSearchFinished: jest.fn().mockResolvedValue(undefined) };
    const projectImportRepository = { existingProjectUrls: jest.fn().mockResolvedValue(new Set(existingUrls)) };
    return {
      manager: new ProjectSearchJobManager(
        projectImportRepository as any,
        repository,
        logger as any,
        operationsAudit as any
      ),
      repository,
      logger,
      operationsAudit,
      projectImportRepository
    };
  }

  async function startJob(manager: ProjectSearchJobManager, sourceProvider: any, dto: any, search: any) {
    return manager.start(organizationId, ownerUserId, sourceProvider, dto, search);
  }

  async function waitForTerminal(manager: ProjectSearchJobManager, id: string) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const job = await manager.get(id, organizationId, ownerUserId);
      if (job.status !== 'running') return job;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('search job did not finish');
  }

  it('persists a completed job when the desired count is reached', async () => {
    const { manager, repository, operationsAudit } = createManager();
    const items = Array.from({ length: 10 }, (_, index) => ({ url: `https://camp-fire.jp/projects/${index}` }));
    const started = await startJob(manager, provider, { limit: 10 }, jest.fn().mockResolvedValue({ items, diagnostics }));

    const job = await waitForTerminal(manager, started.id);

    expect(job).toMatchObject({ status: 'completed', completionReason: 'desired_reached', importableCount: 10 });
    expect(repository.jobs.get(started.id)?.items).toHaveLength(10);
    expect(operationsAudit.recordSearchFinished).toHaveBeenCalledWith(expect.objectContaining({
      id: started.id, status: 'completed', completionReason: 'desired_reached', source: 'campfire'
    }));
  });

  it('persists source and condition shortage completion reasons', async () => {
    const first = createManager();
    const items = Array.from({ length: 8 }, (_, index) => ({ url: `https://camp-fire.jp/projects/${index}` }));
    const exhausted = await startJob(first.manager, provider, { limit: 10 }, jest.fn().mockResolvedValue({
      items,
      diagnostics: { ...diagnostics, sourceCandidateCount: 8, conditionMatchedCount: 8 }
    }));
    await expect(waitForTerminal(first.manager, exhausted.id)).resolves.toMatchObject({ completionReason: 'source_exhausted' });

    const second = createManager();
    const shortage = await startJob(second.manager, provider, { limit: 10, status: 'endingSoon' }, jest.fn().mockResolvedValue({
      items,
      diagnostics: { ...diagnostics, conditionMatchedCount: 8 }
    }));
    const completed = await waitForTerminal(second.manager, shortage.id);
    expect(completed).toMatchObject({ completionReason: 'condition_shortage' });
    expect(completed.message).toContain('条件一致が8件');
  });

  it('persists a provider failure without losing the reason', async () => {
    const { manager, logger } = createManager();
    const started = await startJob(
      manager,
      provider,
      { limit: 10 },
      jest.fn().mockRejectedValue(new ProjectSourceSearchError(new Error('provider timeout secret@example.com')))
    );

    const job = await waitForTerminal(manager, started.id);

    expect(job).toMatchObject({ status: 'failed', completionReason: 'failed' });
    expect(job.message).toContain('取得元への接続に失敗');
    expect(job.message).not.toContain('secret@example.com');
    expect(logger.errorEvent).toHaveBeenCalledWith('scraper.search_failed', {
      organizationId,
      userId: ownerUserId,
      entityType: 'ProjectSearchJob',
      entityId: started.id,
      operation: 'search',
      source: 'campfire',
      error: expect.any(Error)
    });
  });

  it('does not misclassify repository failures as scraper failures', async () => {
    const { manager, logger, projectImportRepository } = createManager();
    projectImportRepository.existingProjectUrls.mockRejectedValue(new Error('database unavailable'));
    const started = await startJob(manager, provider, { limit: 10 }, jest.fn());

    const job = await waitForTerminal(manager, started.id);

    expect(job).toMatchObject({ status: 'failed', completionReason: 'failed' });
    expect(job.message).toContain('検索処理に失敗');
    expect(logger.errorEvent).not.toHaveBeenCalled();
  });

  it('aborts the local provider and prevents late writes after cancellation', async () => {
    const { manager, operationsAudit } = createManager();
    let emitItems!: (items: Array<{ url: string }>) => Promise<boolean>;
    let receivedSignal: AbortSignal | undefined;
    const search = jest.fn((_provider, _dto, options) => new Promise<never>((_, reject) => {
      receivedSignal = options.signal;
      emitItems = options.onItems;
      options.signal.addEventListener('abort', () => reject(new Error('page closed')), { once: true });
    }));
    const started = await startJob(manager, provider, { limit: 10 }, search);
    await waitUntil(() => Boolean(receivedSignal));

    const cancelled = await manager.cancel(started.id, organizationId, ownerUserId);

    expect(receivedSignal?.aborted).toBe(true);
    expect(cancelled).toMatchObject({ status: 'cancelled', completionReason: 'cancelled' });
    expect(operationsAudit.recordSearchFinished).toHaveBeenCalledWith(expect.objectContaining({
      id: started.id, status: 'cancelled', completionReason: 'cancelled'
    }));
    await expect(emitItems([{ url: 'https://camp-fire.jp/projects/late' }])).resolves.toBe(false);
    await expect(manager.get(started.id, organizationId, ownerUserId)).resolves.toMatchObject({ itemCount: 0 });
  });

  it('does not record a second terminal event when cancel is retried after completion', async () => {
    const { manager, operationsAudit } = createManager();
    const started = await startJob(manager, provider, { limit: 1 }, jest.fn().mockResolvedValue({
      items: [{ url: 'https://camp-fire.jp/projects/completed' }],
      diagnostics
    }));
    await waitForTerminal(manager, started.id);
    operationsAudit.recordSearchFinished.mockClear();

    await expect(manager.cancel(started.id, organizationId, ownerUserId))
      .resolves.toMatchObject({ status: 'completed' });

    expect(operationsAudit.recordSearchFinished).not.toHaveBeenCalled();
  });

  it('adds progressive candidates, removes existing URLs, and preserves normalized order', async () => {
    const { manager } = createManager(undefined, ['https://camp-fire.jp/projects/existing']);
    let finish!: (value: any) => void;
    const search = jest.fn(async (_provider, _dto, options) => {
      await options.onItems([
        { url: 'https://camp-fire.jp/projects/existing?tracking=1' },
        { url: 'https://camp-fire.jp/projects/first?tracking=1', title: '最初' },
        { url: 'https://camp-fire.jp/projects/second', title: '二番目' }
      ]);
      return new Promise((resolve) => { finish = resolve; });
    });
    const started = await startJob(manager, provider, { limit: 10 }, search);
    await waitUntil(() => Boolean(finish));

    const running = await manager.get(started.id, organizationId, ownerUserId);
    expect(running.items.map((item: any) => item.url)).toEqual([
      'https://camp-fire.jp/projects/first?tracking=1',
      'https://camp-fire.jp/projects/second'
    ]);

    finish({
      items: [
        { url: 'https://camp-fire.jp/projects/first', title: '更新済み' },
        ...Array.from({ length: 12 }, (_, index) => ({ url: `https://camp-fire.jp/projects/new-${index}` }))
      ],
      diagnostics
    });
    const completed = await waitForTerminal(manager, started.id);
    expect(completed.items).toHaveLength(10);
    expect(completed.items[0]).toMatchObject({ url: 'https://camp-fire.jp/projects/first', title: '更新済み' });
  });

  it('uses one abort signal for every progressive provider call', async () => {
    const { manager } = createManager();
    const signals: AbortSignal[] = [];
    const search = jest.fn((_provider, _dto, options) => {
      signals.push(options.signal);
      return Promise.resolve({
        items: [],
        diagnostics: { sourceCandidateCount: 0, conditionMatchedCount: 0, excludedCount: 0, scanComplete: true }
      });
    });
    const started = await startJob(manager, provider, { limit: 10 }, search);

    await waitForTerminal(manager, started.id);

    expect(signals).toHaveLength(5);
    expect(new Set(signals).size).toBe(1);
  });

  it('shares progress across instances and accepts cancellation from another instance', async () => {
    const repository = new InMemorySearchJobRepository();
    const first = createManager(repository).manager;
    const second = createManager(repository).manager;
    let aborted = false;
    const search = jest.fn((_provider, _dto, options) => new Promise<never>((_, reject) => {
      options.signal.addEventListener('abort', () => {
        aborted = true;
        reject(new Error('cancelled by another instance'));
      }, { once: true });
    }));
    const started = await startJob(first, provider, { limit: 10 }, search);
    await expect(second.get(started.id, organizationId, ownerUserId)).resolves.toMatchObject({ status: 'running' });

    await second.cancel(started.id, organizationId, ownerUserId);
    await waitUntil(() => aborted, 1500);

    await expect(first.get(started.id, organizationId, ownerUserId)).resolves.toMatchObject({ status: 'cancelled' });
  });

  it('restores terminal state through a new manager instance', async () => {
    const repository = new InMemorySearchJobRepository();
    const first = createManager(repository).manager;
    const started = await startJob(first, provider, { limit: 1 }, jest.fn().mockResolvedValue({
      items: [{ url: 'https://camp-fire.jp/projects/persisted' }],
      diagnostics
    }));
    await waitForTerminal(first, started.id);

    const restarted = createManager(repository).manager;

    await expect(restarted.get(started.id, organizationId, ownerUserId)).resolves.toMatchObject({
      status: 'completed',
      itemCount: 1
    });
  });

  it('turns a lease-expired running job into a stable failed result', async () => {
    const repository = new InMemorySearchJobRepository();
    const { manager, operationsAudit } = createManager(repository);
    const started = await startJob(manager, provider, { limit: 10 }, jest.fn().mockReturnValue(new Promise(() => undefined)));
    const stored = repository.jobs.get(started.id)!;
    stored.leaseExpiresAt = new Date(Date.now() - 1);

    const recovered = createManager(repository);
    const failed = await recovered.manager.get(started.id, organizationId, ownerUserId);

    expect(failed).toMatchObject({ status: 'failed', completionReason: 'failed' });
    expect(failed.message).toContain('実行サーバーが停止');
    expect(recovered.operationsAudit.recordSearchFinished).toHaveBeenCalledWith(expect.objectContaining({
      id: started.id, status: 'failed', completionReason: 'failed'
    }));
    manager.cancel(started.id, organizationId, ownerUserId).catch(() => undefined);
  });

  it('hides jobs from another organization or owner with the same 404', async () => {
    const { manager } = createManager();
    const started = await startJob(manager, provider, { limit: 10 }, jest.fn().mockReturnValue(new Promise(() => undefined)));

    await expect(manager.get(started.id, 'organization-2', ownerUserId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(manager.cancel(started.id, organizationId, 'user-2')).rejects.toBeInstanceOf(NotFoundException);
    await manager.cancel(started.id, organizationId, ownerUserId);
  });

  it('cancels the same owner previous job when a new search starts', async () => {
    const repository = new InMemorySearchJobRepository();
    const { manager } = createManager(repository);
    const pending = jest.fn().mockReturnValue(new Promise(() => undefined));
    const first = await startJob(manager, provider, { limit: 10 }, pending);

    const second = await startJob(manager, provider, { limit: 10 }, pending);

    await expect(manager.get(first.id, organizationId, ownerUserId)).resolves.toMatchObject({ status: 'cancelled' });
    await expect(manager.get(second.id, organizationId, ownerUserId)).resolves.toMatchObject({ status: 'running' });
    await manager.cancel(second.id, organizationId, ownerUserId);
  });

  it('keeps the previous worker running when replacement persistence fails', async () => {
    const repository = new InMemorySearchJobRepository();
    const { manager } = createManager(repository);
    let firstSignal: AbortSignal | undefined;
    const pending = jest.fn((_provider, _dto, options) => {
      firstSignal ||= options.signal;
      return new Promise(() => undefined);
    });
    const first = await startJob(manager, provider, { limit: 10 }, pending);
    await waitUntil(() => Boolean(firstSignal));
    repository.failNextCreate = true;

    await expect(startJob(manager, provider, { limit: 10 }, pending)).rejects.toThrow('database unavailable');

    expect(firstSignal?.aborted).toBe(false);
    await expect(manager.get(first.id, organizationId, ownerUserId)).resolves.toMatchObject({ status: 'running' });
    await manager.cancel(first.id, organizationId, ownerUserId);
  });
});

class InMemorySearchJobRepository extends ProjectSearchJobRepository {
  readonly jobs = new Map<string, StoredProjectSearchJob>();
  failNextCreate = false;

  async create(input: StoredProjectSearchJob) {
    if (this.failNextCreate) {
      this.failNextCreate = false;
      throw new Error('database unavailable');
    }
    const now = new Date();
    for (const job of this.jobs.values()) {
      if (job.organizationId === input.organizationId && job.ownerUserId === input.ownerUserId && job.status === 'running') {
        job.status = 'cancelled';
        job.completionReason = 'cancelled';
        job.cancelRequestedAt = now;
        job.updatedAt = now;
      }
    }
    this.jobs.set(input.id, cloneJob(input));
    return cloneJob(input);
  }

  async findOwned(id: string, organizationId: string, ownerUserId: string, now: Date) {
    const job = this.jobs.get(id);
    return job && job.organizationId === organizationId && job.ownerUserId === ownerUserId && job.expiresAt > now
      ? cloneJob(job)
      : null;
  }

  async findWorkerControl(id: string, workerId: string): Promise<ProjectSearchJobControl | null> {
    const job = this.jobs.get(id);
    return job && job.workerId === workerId
      ? { status: job.status, cancelRequestedAt: job.cancelRequestedAt, leaseExpiresAt: job.leaseExpiresAt }
      : null;
  }

  async updateProgress(
    id: string,
    workerId: string,
    progress: ProjectSearchJobProgress,
    leaseExpiresAt: Date,
    expiresAt: Date
  ) {
    const job = this.writable(id, workerId);
    if (!job) return false;
    Object.assign(job, cloneValue(progress), { leaseExpiresAt, expiresAt, updatedAt: new Date() });
    return true;
  }

  async heartbeat(id: string, workerId: string, leaseExpiresAt: Date, expiresAt: Date) {
    const job = this.writable(id, workerId);
    if (!job) return false;
    Object.assign(job, { leaseExpiresAt, expiresAt, updatedAt: new Date() });
    return true;
  }

  async finish(id: string, workerId: string, update: ProjectSearchJobTerminalUpdate, expiresAt: Date) {
    const job = this.writable(id, workerId);
    if (!job) return false;
    Object.assign(job, cloneValue(update), { expiresAt, updatedAt: new Date() });
    return true;
  }

  async requestCancel(
    id: string,
    organizationId: string,
    ownerUserId: string,
    message: string,
    now: Date,
    expiresAt: Date
  ) {
    const job = this.jobs.get(id);
    if (!job || job.organizationId !== organizationId || job.ownerUserId !== ownerUserId || job.expiresAt <= now) return null;
    if (job.status === 'running') {
      Object.assign(job, {
        status: 'cancelled' as const,
        completionReason: 'cancelled' as const,
        cancelRequestedAt: now,
        message,
        expiresAt,
        updatedAt: now
      });
    }
    return cloneJob(job);
  }

  async failExpiredLease(
    id: string,
    organizationId: string,
    ownerUserId: string,
    now: Date,
    message: string,
    expiresAt: Date
  ) {
    const job = this.jobs.get(id);
    if (!job || job.organizationId !== organizationId || job.ownerUserId !== ownerUserId || job.expiresAt <= now) return null;
    if (job.status === 'running' && job.leaseExpiresAt <= now) {
      Object.assign(job, {
        status: 'failed' as const,
        completionReason: 'failed' as const,
        message,
        expiresAt,
        updatedAt: now
      });
    }
    return cloneJob(job);
  }

  async deleteExpired(now: Date) {
    let deleted = 0;
    for (const [id, job] of this.jobs.entries()) {
      if (job.expiresAt <= now) {
        this.jobs.delete(id);
        deleted += 1;
      }
    }
    return deleted;
  }

  private writable(id: string, workerId: string) {
    const job = this.jobs.get(id);
    return job && job.workerId === workerId && job.status === 'running' && !job.cancelRequestedAt ? job : null;
  }
}

function cloneJob(job: StoredProjectSearchJob): StoredProjectSearchJob {
  return {
    ...cloneValue(job),
    cancelRequestedAt: job.cancelRequestedAt ? new Date(job.cancelRequestedAt) : undefined,
    leaseExpiresAt: new Date(job.leaseExpiresAt),
    expiresAt: new Date(job.expiresAt),
    startedAt: new Date(job.startedAt),
    updatedAt: new Date(job.updatedAt)
  };
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function waitUntil(predicate: () => boolean, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('condition was not met');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
