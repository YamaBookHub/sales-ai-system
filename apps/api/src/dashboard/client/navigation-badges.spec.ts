import { renderNavigationBadgesScript } from './navigation-badges';

describe('navigation badges client', () => {
  it.each([
    [['reports.read', 'ai.cost.read'], false],
    [['reports.read'], true]
  ])('shows restricted navigation only when every permission is granted', async (permissions, hidden) => {
    const operationsButton = {
      hidden: true,
      getAttribute: jest.fn().mockReturnValue('reports.read ai.cost.read')
    };
    const document = {
      querySelector: jest.fn().mockReturnValue(null),
      querySelectorAll: jest.fn().mockReturnValue([operationsButton])
    };
    const window = {
      SalesAiApi: {
        request: jest.fn().mockResolvedValue({ today: 0, replies: 0, leads: 0, mail: 0 }),
        loadCurrentUser: jest.fn().mockResolvedValue({ user: { permissions } })
      }
    };

    const script = renderNavigationBadgesScript();
    expect(() => new Function('window', 'document', script)).not.toThrow();
    new Function('window', 'document', script)(window, document);
    await new Promise((resolve) => setImmediate(resolve));

    expect(operationsButton.hidden).toBe(hidden);
  });
});
