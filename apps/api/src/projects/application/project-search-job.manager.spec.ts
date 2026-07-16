import { ProjectSearchJobManager } from './project-search-job.manager';

describe('ProjectSearchJobManager', () => {
  const provider = { source: 'campfire', baseUrl: 'https://camp-fire.jp' } as any;
  const diagnostics = {
    sourceCandidateCount: 10,
    conditionMatchedCount: 10,
    excludedCount: 0,
    scanComplete: true
  };

  function createManager(existingUrls: string[] = []) {
    return new ProjectSearchJobManager({
      existingProjectUrls: jest.fn().mockResolvedValue(new Set(existingUrls))
    } as any);
  }

  async function waitForTerminal(manager: ProjectSearchJobManager, id: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const job = manager.get(id);
      if (job.status !== 'running') return job;
      await new Promise((resolve) => setImmediate(resolve));
    }
    throw new Error('search job did not finish');
  }

  it('reports desired_reached', async () => {
    const manager = createManager();
    const items = Array.from({ length: 10 }, (_, index) => ({ url: `https://camp-fire.jp/projects/${index}` }));
    const started = manager.start(provider, { limit: 10 }, jest.fn().mockResolvedValue({ items, diagnostics }));

    const job = await waitForTerminal(manager, started.id);
    expect(job).toMatchObject({ status: 'completed', completionReason: 'desired_reached', importableCount: 10 });
  });

  it('reports source_exhausted without restrictive conditions', async () => {
    const manager = createManager();
    const items = Array.from({ length: 8 }, (_, index) => ({ url: `https://camp-fire.jp/projects/${index}` }));
    const started = manager.start(
      provider,
      { limit: 10 },
      jest.fn().mockResolvedValue({
        items,
        diagnostics: { ...diagnostics, sourceCandidateCount: 8, conditionMatchedCount: 8 }
      })
    );

    const job = await waitForTerminal(manager, started.id);
    expect(job).toMatchObject({ status: 'completed', completionReason: 'source_exhausted', importableCount: 8 });
  });

  it('reports condition_shortage when a condition leaves fewer matches', async () => {
    const manager = createManager();
    const items = Array.from({ length: 8 }, (_, index) => ({ url: `https://camp-fire.jp/projects/${index}` }));
    const started = manager.start(
      provider,
      { limit: 10, status: 'endingSoon' },
      jest.fn().mockResolvedValue({ items, diagnostics: { ...diagnostics, conditionMatchedCount: 8 } })
    );

    const job = await waitForTerminal(manager, started.id);
    expect(job).toMatchObject({ status: 'completed', completionReason: 'condition_shortage' });
    expect(job.message).toContain('条件一致が8件');
  });

  it('reports excluded_existing when exclusions explain the shortage', async () => {
    const manager = createManager(['https://camp-fire.jp/projects/existing']);
    const items = Array.from({ length: 8 }, (_, index) => ({ url: `https://camp-fire.jp/projects/${index}` }));
    const started = manager.start(
      provider,
      { limit: 10 },
      jest.fn().mockResolvedValue({ items, diagnostics: { ...diagnostics, conditionMatchedCount: 10, excludedCount: 2 } })
    );

    const job = await waitForTerminal(manager, started.id);
    expect(job).toMatchObject({ status: 'completed', completionReason: 'excluded_existing' });
  });

  it('reports failed when the provider throws', async () => {
    const manager = createManager();
    const started = manager.start(provider, { limit: 10 }, jest.fn().mockRejectedValue(new Error('provider timeout')));

    const job = await waitForTerminal(manager, started.id);
    expect(job).toMatchObject({ status: 'failed', completionReason: 'failed' });
    expect(job.message).toContain('provider timeout');
  });

  it('keeps cancelled terminal state when an in-flight provider later rejects', async () => {
    const manager = createManager();
    let rejectSearch!: (error: Error) => void;
    const pending = new Promise<never>((_, reject) => {
      rejectSearch = reject;
    });
    const started = manager.start(provider, { limit: 10 }, jest.fn().mockReturnValue(pending));
    await new Promise((resolve) => setImmediate(resolve));

    const cancelled = manager.cancel(started.id);
    rejectSearch(new Error('page closed'));
    await new Promise((resolve) => setImmediate(resolve));

    expect(cancelled).toMatchObject({ status: 'cancelled', completionReason: 'cancelled' });
    expect(manager.get(started.id)).toMatchObject({ status: 'cancelled', completionReason: 'cancelled' });
  });
});
