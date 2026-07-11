import { SearchProjectsUseCase } from './search-projects.usecase';

describe('SearchProjectsUseCase', () => {
  const createDeps = () => {
    const jobManager = {
      start: jest.fn().mockReturnValue({ id: 'job_1', status: 'running' }),
      get: jest.fn().mockReturnValue({ id: 'job_1' }),
      cancel: jest.fn().mockReturnValue({ id: 'job_1', status: 'cancelled' })
    };
    const campfireProvider = {
      source: 'campfire',
      search: jest.fn().mockResolvedValue({
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

    const result = await useCase.search({ source: 'makuake', keyword: '食品' });

    expect(makuakeProvider.search).toHaveBeenCalledWith({ source: 'makuake', keyword: '食品', excludeUrls: [] });
    expect(result).toEqual({ items: [{ url: 'https://www.makuake.com/project/1' }] });
  });

  it('sorts and limits ending soon projects', async () => {
    const { jobManager, campfireProvider, makuakeProvider } = createDeps();
    const useCase = new SearchProjectsUseCase(jobManager as any, campfireProvider as any, makuakeProvider as any);

    const result = await useCase.searchCampfire({ status: 'endingSoon', endingSoonDays: 14, limit: 10 });

    expect(result.items.map((item: { url: string }) => item.url)).toEqual([
      'https://camp-fire.jp/projects/2',
      'https://camp-fire.jp/projects/4'
    ]);
  });

  it('starts search job with selected provider and usecase search callback', () => {
    const { jobManager, campfireProvider, makuakeProvider } = createDeps();
    const useCase = new SearchProjectsUseCase(jobManager as any, campfireProvider as any, makuakeProvider as any);

    const job = useCase.startJob({ source: 'campfire', limit: 50 });

    expect(job).toEqual({ id: 'job_1', status: 'running' });
    expect(jobManager.start).toHaveBeenCalledWith(campfireProvider, { source: 'campfire', limit: 50 }, expect.any(Function));
  });
});
