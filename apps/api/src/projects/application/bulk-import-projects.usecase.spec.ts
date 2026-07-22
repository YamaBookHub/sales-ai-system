import { BulkImportProjectsUseCase } from './bulk-import-projects.usecase';

describe('BulkImportProjectsUseCase', () => {
  const actor = { userId: 'user_1', sessionId: 'session_1', organizationId: 'organization_1' };
  const importedProject = {
    source: 'campfire',
    platform: { type: 'campfire', name: 'CAMPFIRE', baseUrl: 'https://camp-fire.jp' },
    company: { name: 'テスト株式会社' },
    project: {
      title: 'テストプロジェクト',
      url: 'https://camp-fire.jp/projects/1/view',
      status: 'active',
      amount: 1000000,
      supporterCount: 100,
      scrapedAt: new Date('2026-07-11T00:00:00.000Z')
    },
    lead: { source: 'campfire', reason: 'テスト' },
    raw: { ok: true }
  };

  const createDeps = () => {
    const ai = {
      analyzeLead: jest.fn().mockResolvedValue({ id: 'generation_1' })
    };
    const repository = {
      persistImportedProject: jest.fn().mockResolvedValue({
        company: { id: 'company_1' },
        project: { id: 'project_1' },
        lead: { id: 'lead_1' }
      }),
      recordBulkImportAudit: jest.fn()
    };
    const campfireProvider = {
      source: 'campfire',
      normalizeUrl: jest.fn((url: string) => url.split('?')[0].replace(/\/$/, '')),
      import: jest.fn().mockResolvedValue(importedProject)
    };
    const makuakeProvider = {
      source: 'makuake',
      normalizeUrl: jest.fn((url: string) => url),
      import: jest.fn()
    };

    return { ai, repository, campfireProvider, makuakeProvider };
  };

  it('imports unique URLs, analyzes imported leads, and records audit summary', async () => {
    const { ai, repository, campfireProvider, makuakeProvider } = createDeps();
    const useCase = new BulkImportProjectsUseCase(
      ai as any,
      repository as any,
      campfireProvider as any,
      makuakeProvider as any,
      { errorEvent: jest.fn() } as any
    );

    const summary = await useCase.execute({
      source: 'campfire',
      urls: ['https://camp-fire.jp/projects/1/view?utm=1', 'https://camp-fire.jp/projects/1/view/'],
      analyze: true
    }, actor);

    expect(campfireProvider.import).toHaveBeenCalledTimes(1);
    expect(repository.persistImportedProject).toHaveBeenCalledWith(
      actor.organizationId,
      importedProject,
      expect.objectContaining({
        bulk: true,
        actor
      })
    );
    expect(ai.analyzeLead).toHaveBeenCalledWith('lead_1', actor);
    expect(summary).toMatchObject({
      source: 'campfire',
      total: 1,
      imported: 1,
      failed: 0,
      analyzed: 1,
      analysisFailed: 0
    });
    expect(repository.recordBulkImportAudit).toHaveBeenCalledWith(actor.organizationId, actor, summary);
  });

  it('can import without AI analysis', async () => {
    const { ai, repository, campfireProvider, makuakeProvider } = createDeps();
    const useCase = new BulkImportProjectsUseCase(
      ai as any,
      repository as any,
      campfireProvider as any,
      makuakeProvider as any,
      { errorEvent: jest.fn() } as any
    );

    const summary = await useCase.execute({
      source: 'campfire',
      urls: ['https://camp-fire.jp/projects/1/view'],
      analyze: false
    }, actor);

    expect(ai.analyzeLead).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      imported: 1,
      analyzed: 0
    });
  });

  it('records only provider failures as scraper failures during bulk import', async () => {
    const { ai, repository, campfireProvider, makuakeProvider } = createDeps();
    const logger = { errorEvent: jest.fn() };
    campfireProvider.import.mockRejectedValue(new Error('provider failed'));
    const useCase = new BulkImportProjectsUseCase(
      ai as any,
      repository as any,
      campfireProvider as any,
      makuakeProvider as any,
      logger as any
    );

    const summary = await useCase.execute({
      source: 'campfire',
      urls: ['https://camp-fire.jp/projects/1/view'],
      analyze: false
    }, actor);

    expect(summary).toMatchObject({ imported: 0, failed: 1 });
    expect(logger.errorEvent).toHaveBeenCalledWith('scraper.import_failed', expect.objectContaining({
      organizationId: actor.organizationId,
      userId: actor.userId,
      operation: 'bulk_import',
      source: 'campfire',
      error: expect.any(Error)
    }));
  });

  it('does not misclassify persistence failures as scraper failures during bulk import', async () => {
    const { ai, repository, campfireProvider, makuakeProvider } = createDeps();
    const logger = { errorEvent: jest.fn() };
    repository.persistImportedProject.mockRejectedValue(new Error('database unavailable'));
    const useCase = new BulkImportProjectsUseCase(
      ai as any,
      repository as any,
      campfireProvider as any,
      makuakeProvider as any,
      logger as any
    );

    const summary = await useCase.execute({
      source: 'campfire',
      urls: ['https://camp-fire.jp/projects/1/view'],
      analyze: false
    }, actor);

    expect(summary).toMatchObject({ imported: 0, failed: 1 });
    expect(logger.errorEvent).not.toHaveBeenCalled();
  });
});
