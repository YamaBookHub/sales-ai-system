import { BadRequestException } from '@nestjs/common';
import { ImportProjectUseCase } from './import-project.usecase';

describe('ImportProjectUseCase', () => {
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
    const repository = {
      persistImportedProject: jest.fn().mockResolvedValue({
        company: { id: 'company_1' },
        project: { id: 'project_1' },
        lead: { id: 'lead_1' }
      })
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

    const operationsAudit = { recordDirectImportFailure: jest.fn().mockResolvedValue(undefined) };
    return { repository, campfireProvider, makuakeProvider, operationsAudit };
  };

  it('imports active project through the selected provider and persists normalized result', async () => {
    const { repository, campfireProvider, makuakeProvider, operationsAudit } = createDeps();
    const useCase = new ImportProjectUseCase(
      repository as any,
      campfireProvider as any,
      makuakeProvider as any,
      { errorEvent: jest.fn() } as any,
      operationsAudit as any
    );

    const result = await useCase.import(
      { source: 'campfire', url: 'https://camp-fire.jp/projects/1/view?utm=1' },
      actor
    );

    expect(campfireProvider.import).toHaveBeenCalledWith('https://camp-fire.jp/projects/1/view');
    expect(repository.persistImportedProject).toHaveBeenCalledWith(
      actor.organizationId,
      importedProject,
      expect.objectContaining({
        actor
      })
    );
    expect(result).toMatchObject({
      company: { id: 'company_1' },
      project: { id: 'project_1' },
      lead: { id: 'lead_1' },
      scraped: { ok: true }
    });
  });

  it('does not persist inactive projects', async () => {
    const { repository, campfireProvider, makuakeProvider, operationsAudit } = createDeps();
    const logger = { errorEvent: jest.fn() };
    campfireProvider.import.mockResolvedValue({
      ...importedProject,
      project: { ...importedProject.project, status: 'ended' }
    });
    const useCase = new ImportProjectUseCase(
      repository as any,
      campfireProvider as any,
      makuakeProvider as any,
      logger as any,
      operationsAudit as any
    );

    await expect(useCase.import(
      { source: 'campfire', url: 'https://camp-fire.jp/projects/1/view' },
      actor
    )).rejects.toThrow(BadRequestException);
    expect(repository.persistImportedProject).not.toHaveBeenCalled();
    expect(logger.errorEvent).not.toHaveBeenCalled();
    expect(operationsAudit.recordDirectImportFailure).toHaveBeenCalledWith(actor, 'campfire');
  });

  it('records provider import failures as scraper failures', async () => {
    const { repository, campfireProvider, makuakeProvider, operationsAudit } = createDeps();
    const logger = { errorEvent: jest.fn() };
    campfireProvider.import.mockRejectedValue(new Error('provider failed test@example.com'));
    const useCase = new ImportProjectUseCase(repository as any, campfireProvider as any, makuakeProvider as any, logger as any, operationsAudit as any);

    await expect(useCase.import(
      { source: 'campfire', url: 'https://camp-fire.jp/projects/1/view' },
      actor
    )).rejects.toThrow('provider failed');

    expect(logger.errorEvent).toHaveBeenCalledWith('scraper.import_failed', {
      organizationId: actor.organizationId,
      userId: actor.userId,
      entityType: 'CrowdfundingProject',
      operation: 'import',
      source: 'campfire',
      error: expect.any(Error)
    });
    expect(operationsAudit.recordDirectImportFailure).toHaveBeenCalledWith(actor, 'campfire');
  });

  it('does not misclassify persistence failures as scraper failures', async () => {
    const { repository, campfireProvider, makuakeProvider, operationsAudit } = createDeps();
    const logger = { errorEvent: jest.fn() };
    repository.persistImportedProject.mockRejectedValue(new Error('database unavailable'));
    const useCase = new ImportProjectUseCase(repository as any, campfireProvider as any, makuakeProvider as any, logger as any, operationsAudit as any);

    await expect(useCase.import(
      { source: 'campfire', url: 'https://camp-fire.jp/projects/1/view' },
      actor
    )).rejects.toThrow('database unavailable');

    expect(logger.errorEvent).not.toHaveBeenCalled();
    expect(operationsAudit.recordDirectImportFailure).toHaveBeenCalledWith(actor, 'campfire');
  });
});
