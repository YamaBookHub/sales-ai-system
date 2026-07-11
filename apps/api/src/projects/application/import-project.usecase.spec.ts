import { BadRequestException } from '@nestjs/common';
import { ImportProjectUseCase } from './import-project.usecase';

describe('ImportProjectUseCase', () => {
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
      resolveActorUserId: jest.fn().mockResolvedValue('user_1'),
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

    return { repository, campfireProvider, makuakeProvider };
  };

  it('imports active project through the selected provider and persists normalized result', async () => {
    const { repository, campfireProvider, makuakeProvider } = createDeps();
    const useCase = new ImportProjectUseCase(repository as any, campfireProvider as any, makuakeProvider as any);

    const result = await useCase.import(
      { source: 'campfire', url: 'https://camp-fire.jp/projects/1/view?utm=1' },
      { operatorEmail: 'operator@example.com' }
    );

    expect(campfireProvider.import).toHaveBeenCalledWith('https://camp-fire.jp/projects/1/view');
    expect(repository.resolveActorUserId).toHaveBeenCalledWith({ operatorEmail: 'operator@example.com' });
    expect(repository.persistImportedProject).toHaveBeenCalledWith(
      importedProject,
      expect.objectContaining({
        actor: { operatorEmail: 'operator@example.com' },
        userId: 'user_1'
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
    const { repository, campfireProvider, makuakeProvider } = createDeps();
    campfireProvider.import.mockResolvedValue({
      ...importedProject,
      project: { ...importedProject.project, status: 'ended' }
    });
    const useCase = new ImportProjectUseCase(repository as any, campfireProvider as any, makuakeProvider as any);

    await expect(useCase.import({ source: 'campfire', url: 'https://camp-fire.jp/projects/1/view' })).rejects.toThrow(BadRequestException);
    expect(repository.persistImportedProject).not.toHaveBeenCalled();
  });
});
