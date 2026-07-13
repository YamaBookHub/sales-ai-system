import { NavigationSummaryService } from './navigation-summary.service';

describe('NavigationSummaryService', () => {
  it('calculates the same actionable counts for every page', async () => {
    const prisma = {
      salesLead: {
        findMany: jest.fn().mockResolvedValue([
          {
            status: 'discovered',
            nextActionAt: null,
            nextFollowUpAt: '2026-07-11T14:59:59.000Z',
            tasks: [],
            mails: [{ status: 'draft' }]
          },
          {
            status: 'replied',
            nextActionAt: null,
            nextFollowUpAt: null,
            tasks: [],
            mails: [{ status: 'sent' }]
          },
          {
            status: 'discovered',
            nextActionAt: null,
            nextFollowUpAt: '2026-07-12T15:00:00.000Z',
            tasks: [],
            mails: [{ status: 'sent' }]
          }
        ])
      },
      outreachEmail: { count: jest.fn().mockResolvedValue(4) },
      emailReply: { count: jest.fn().mockResolvedValue(2) }
    } as never;
    const service = new NavigationSummaryService(prisma);

    await expect(service.getSummary(new Date('2026-07-12T03:00:00.000Z'))).resolves.toEqual({
      today: 2,
      replies: 2,
      leads: 3,
      mail: 4
    });
  });
});
