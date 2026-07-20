import { SearchProjectsUseCase } from './search-projects.usecase';

describe('SearchProjectsUseCase', () => {
  const organizationId = 'organization_1';
  const ownerUserId = 'user_1';
  const createDeps = () => {
    const jobManager = {
      start: jest.fn().mockReturnValue({ id: 'job_1', status: 'running' }),
      get: jest.fn().mockReturnValue({ id: 'job_1' }),
      cancel: jest.fn().mockReturnValue({ id: 'job_1', status: 'cancelled' })
    };
    const campfireProvider = {
      source: 'campfire',
      search: jest.fn().mockResolvedValue({
        diagnostics: {
          sourceCandidateCount: 4,
          conditionMatchedCount: 2,
          excludedCount: 0,
          scanComplete: true
        },
        items: [
          { url: 'https://camp-fire.jp/projects/1', daysLeft: 20, isActive: true },
          { url: 'https://camp-fire.jp/projects/2', daysLeft: 3, isActive: true },
          { url: 'https://camp-fire.jp/projects/3', daysLeft: 1, isActive: false },
          { url: 'https://camp-fire.jp/projects/4', daysLeft: 9, isActive: true }
        ]
      })
    };
    const makuakeProvider = {
      source: 'makuake',
      search: jest.fn().mockResolvedValue({ items: [{ url: 'https://www.makuake.com/project/1' }] })
    };

    return { jobManager, campfireProvider, makuakeProvider };
  };

  it('searches with selected provider and default excludeUrls', async () => {
    const { jobManager, campfireProvider, makuakeProvider } = createDeps();
    const useCase = new SearchProjectsUseCase(jobManager as any, campfireProvider as any, makuakeProvider as any);

    const result = await useCase.search({ source: 'makuake', keyword: '食品' }, organizationId);

    expect(makuakeProvider.search).toHaveBeenCalledWith(
      { source: 'makuake', keyword: '食品', excludeUrls: [] },
      undefined
    );
    expect(result).toEqual({ items: [{ url: 'https://www.makuake.com/project/1' }] });
  });

  it('sorts and limits ending soon projects', async () => {
    const { jobManager, campfireProvider, makuakeProvider } = createDeps();
    const useCase = new SearchProjectsUseCase(jobManager as any, campfireProvider as any, makuakeProvider as any);

    const result = await useCase.searchCampfire({ status: 'endingSoon', endingSoonDays: 14, limit: 10 }, organizationId);

    expect(result.items.map((item: { url: string }) => item.url)).toEqual([
      'https://camp-fire.jp/projects/2',
      'https://camp-fire.jp/projects/4'
    ]);
    expect(result.diagnostics).toEqual({
      sourceCandidateCount: 4,
      conditionMatchedCount: 2,
      excludedCount: 0,
      scanComplete: true
    });
  });

  it('starts search job and forwards its abort signal to the provider', async () => {
    const { jobManager, campfireProvider, makuakeProvider } = createDeps();
    const useCase = new SearchProjectsUseCase(jobManager as any, campfireProvider as any, makuakeProvider as any);

    const job = useCase.startJob({ source: 'campfire', limit: 50 }, organizationId, ownerUserId);

    expect(job).toEqual({ id: 'job_1', status: 'running' });
    expect(jobManager.start).toHaveBeenCalledWith(
      organizationId,
      ownerUserId,
      campfireProvider,
      { source: 'campfire', limit: 50 },
      expect.any(Function)
    );
    const callback = jobManager.start.mock.calls[0][4];
    const controller = new AbortController();
    await callback(campfireProvider, { limit: 50 }, { signal: controller.signal });
    expect(campfireProvider.search).toHaveBeenLastCalledWith(
      { limit: 50, excludeUrls: [] },
      { signal: controller.signal }
    );
  });
});
