import { BulkImportProjectsUseCase } from './bulk-import-projects.usecase';

describe('BulkImportProjectsUseCase', () => {
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
      resolveActorUserId: jest.fn().mockResolvedValue('user_1'),
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
    const useCase = new BulkImportProjectsUseCase(ai as any, repository as any, campfireProvider as any, makuakeProvider as any);

    const summary = await useCase.execute({
      source: 'campfire',
      urls: ['https://camp-fire.jp/projects/1/view?utm=1', 'https://camp-fire.jp/projects/1/view/'],
      analyze: true
    });

    expect(campfireProvider.import).toHaveBeenCalledTimes(1);
    expect(repository.persistImportedProject).toHaveBeenCalledWith(
      importedProject,
      expect.objectContaining({
        bulk: true,
        userId: 'user_1'
      })
    );
    expect(ai.analyzeLead).toHaveBeenCalledWith('lead_1');
    expect(summary).toMatchObject({
      source: 'campfire',
      total: 1,
      imported: 1,
      failed: 0,
      analyzed: 1,
      analysisFailed: 0
    });
    expect(repository.recordBulkImportAudit).toHaveBeenCalledWith('user_1', summary);
  });

  it('can import without AI analysis', async () => {
    const { ai, repository, campfireProvider, makuakeProvider } = createDeps();
    const useCase = new BulkImportProjectsUseCase(ai as any, repository as any, campfireProvider as any, makuakeProvider as any);

    const summary = await useCase.execute({
      source: 'campfire',
      urls: ['https://camp-fire.jp/projects/1/view'],
      analyze: false
    });

    expect(ai.analyzeLead).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      imported: 1,
      analyzed: 0
    });
  });
});
