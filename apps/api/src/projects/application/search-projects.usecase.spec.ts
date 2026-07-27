import { SearchProjectsUseCase } from './search-projects.usecase';
import { ProjectSourceSearchError } from '../domain/project-source-provider';

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
    const logger = { errorEvent: jest.fn() };
    const sourceRegistry = {
      get: jest.fn((source?: string) => source === 'makuake' ? makuakeProvider : campfireProvider)
    };

    return { jobManager, campfireProvider, makuakeProvider, sourceRegistry, logger };
  };

  it('searches with selected provider and default excludeUrls', async () => {
    const { jobManager, makuakeProvider, sourceRegistry, logger } = createDeps();
    const useCase = new SearchProjectsUseCase(jobManager as any, sourceRegistry as any, logger as any);

    const result = await useCase.search({ source: 'makuake', keyword: '食品' }, organizationId);

    expect(makuakeProvider.search).toHaveBeenCalledWith(
      { source: 'makuake', keyword: '食品', excludeUrls: [] },
      undefined
    );
    expect(result).toEqual({ items: [{ url: 'https://www.makuake.com/project/1' }] });
  });

  it('sorts and limits ending soon projects', async () => {
    const { jobManager, campfireProvider, sourceRegistry, logger } = createDeps();
    const useCase = new SearchProjectsUseCase(jobManager as any, sourceRegistry as any, logger as any);

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
    const { jobManager, campfireProvider, sourceRegistry, logger } = createDeps();
    const useCase = new SearchProjectsUseCase(jobManager as any, sourceRegistry as any, logger as any);

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

  it('records a synchronous scraper failure without logging input data', async () => {
    const { jobManager, campfireProvider, sourceRegistry, logger } = createDeps();
    campfireProvider.search.mockRejectedValue(new Error('secret@example.com 192.168.1.1'));
    const useCase = new SearchProjectsUseCase(jobManager as any, sourceRegistry as any, logger as any);

    await expect(useCase.search({ source: 'campfire', keyword: 'secret keyword' }, organizationId)).rejects.toThrow();

    expect(logger.errorEvent).toHaveBeenCalledWith('scraper.search_failed', {
      organizationId,
      entityType: 'CrowdfundingProject',
      operation: 'search',
      source: 'campfire',
      error: expect.any(Error)
    });
    expect(logger.errorEvent.mock.calls[0][1]).not.toHaveProperty('keyword');
  });

  it('leaves asynchronous job failure logging to the job manager', async () => {
    const { jobManager, campfireProvider, sourceRegistry, logger } = createDeps();
    campfireProvider.search.mockRejectedValue(new Error('provider failed'));
    const useCase = new SearchProjectsUseCase(jobManager as any, sourceRegistry as any, logger as any);

    useCase.startJob({ source: 'campfire', limit: 50 }, organizationId, ownerUserId);
    const callback = jobManager.start.mock.calls[0][4];
    await expect(callback(campfireProvider, { limit: 50 })).rejects.toBeInstanceOf(ProjectSourceSearchError);

    expect(logger.errorEvent).not.toHaveBeenCalled();
  });
});
