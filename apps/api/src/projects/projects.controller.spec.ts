import { ProjectsController } from './projects.controller';

describe('ProjectsController audit actor propagation', () => {
  const principal = {
    userId: 'user_1',
    sessionId: 'session_1',
    organizationId: 'organization_1',
    organizationSlug: 'organization-1',
    role: 'operator' as const,
    email: 'operator@example.test'
  };
  const actor = { userId: principal.userId, sessionId: principal.sessionId, organizationId: principal.organizationId };

  it('passes the authenticated actor through create and import operations', async () => {
    const projects = { create: jest.fn().mockResolvedValue({}) };
    const imports = {
      importCampfire: jest.fn().mockResolvedValue({}),
      import: jest.fn().mockResolvedValue({})
    };
    const bulkImports = { execute: jest.fn().mockResolvedValue({}) };
    const controller = new ProjectsController(projects as any, {} as any, imports as any, bulkImports as any);

    await controller.create({ title: '案件', url: 'https://example.test/project', platformId: 'platform_1' } as any, principal);
    await controller.importCampfire({ url: 'https://camp-fire.jp/projects/1/view' }, principal);
    await controller.importProject({ source: 'makuake', url: 'https://www.makuake.com/project/example/' }, principal);
    await controller.bulkImport({ source: 'campfire', urls: ['https://camp-fire.jp/projects/1/view'] }, principal);

    expect(projects.create).toHaveBeenCalledWith(expect.any(Object), actor);
    expect(imports.importCampfire).toHaveBeenCalledWith({ url: 'https://camp-fire.jp/projects/1/view' }, actor);
    expect(imports.import).toHaveBeenCalledWith({ source: 'makuake', url: 'https://www.makuake.com/project/example/' }, actor);
    expect(bulkImports.execute).toHaveBeenCalledWith({ source: 'campfire', urls: ['https://camp-fire.jp/projects/1/view'] }, actor);
  });

  it('returns registered project source capabilities', () => {
    const projects = {
      sources: jest.fn().mockReturnValue({
        items: [{ source: 'campfire', name: 'CAMPFIRE', capabilities: { categoryFilter: true } }]
      })
    };
    const controller = new ProjectsController(projects as any, {} as any, {} as any, {} as any);

    expect(controller.sources()).toEqual({
      data: {
        items: [{ source: 'campfire', name: 'CAMPFIRE', capabilities: { categoryFilter: true } }]
      },
      meta: null,
      error: null
    });
  });
});
