import { NavigationSummaryController } from './navigation-summary.controller';

describe('NavigationSummaryController', () => {
  it('uses the organization fixed to the authenticated principal', async () => {
    const navigationSummary = {
      getSummary: jest.fn().mockResolvedValue({ today: 0, replies: 0, leads: 0, mail: 0 })
    };
    const controller = new NavigationSummaryController(navigationSummary as never);
    const principal = {
      userId: 'user_1',
      sessionId: 'session_1',
      email: 'operator@example.com',
      organizationId: 'organization_1',
      organizationSlug: 'default',
      role: 'operator'
    } as const;

    await expect(controller.getSummary(principal)).resolves.toEqual({
      data: { today: 0, replies: 0, leads: 0, mail: 0 },
      meta: null,
      error: null
    });
    expect(navigationSummary.getSummary).toHaveBeenCalledWith('organization_1');
  });
});
