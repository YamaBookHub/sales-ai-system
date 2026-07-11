import { TrackingService } from './tracking.service';

describe('TrackingService', () => {
  const createPrisma = () => ({
    outreachEmail: {
      findUnique: jest.fn().mockResolvedValue({ id: 'mail_1' })
    },
    trackedLink: {
      create: jest.fn().mockResolvedValue({
        id: 'link_1',
        emailId: 'mail_1',
        token: 'token_1',
        originalUrl: 'https://example.com/company.pdf',
        label: 'company_material'
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'link_1',
        emailId: 'mail_1',
        token: 'token_1',
        originalUrl: 'https://example.com/company.pdf',
        label: 'company_material',
        email: { id: 'mail_1', leadId: 'lead_1' }
      }),
      findMany: jest.fn()
    },
    linkClick: {
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(3)
    },
    emailEvent: {
      create: jest.fn()
    },
    salesLead: {
      findUnique: jest.fn().mockResolvedValue({ score: 40 }),
      update: jest.fn()
    }
  });

  it('creates a company material tracked link', async () => {
    const prisma = createPrisma();
    const service = new TrackingService(prisma as any);

    const link = await service.createTrackedLink({
      emailId: 'mail_1',
      originalUrl: 'https://example.com/company.pdf',
      label: 'company_material'
    });

    expect(link.label).toBe('company_material');
    expect(link.trackingPath).toBe('/t/click/token_1');
    expect(prisma.trackedLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        emailId: 'mail_1',
        originalUrl: 'https://example.com/company.pdf',
        label: 'company_material',
        token: expect.any(String)
      })
    });
  });

  it('records material click and raises lead appointment angle', async () => {
    const prisma = createPrisma();
    const service = new TrackingService(prisma as any);

    await expect(service.resolveClick('token_1')).resolves.toBe('https://example.com/company.pdf');
    expect(prisma.linkClick.create).toHaveBeenCalledWith({ data: { linkId: 'link_1' } });
    expect(prisma.emailEvent.create).toHaveBeenCalledWith({
      data: {
        emailId: 'mail_1',
        type: 'clicked',
        payload: {
          label: 'company_material',
          linkId: 'link_1',
          clickCount: 3
        }
      }
    });
    expect(prisma.salesLead.update).toHaveBeenCalledWith({
      where: { id: 'lead_1' },
      data: expect.objectContaining({
        score: 85,
        priority: 'high',
        status: 'meeting_candidate',
        nextActionAt: expect.any(Date)
      })
    });
  });

  it('summarizes material engagement for a mail', async () => {
    const prisma = createPrisma();
    prisma.trackedLink.findMany.mockResolvedValue([
      {
        id: 'link_1',
        token: 'token_1',
        label: 'company_material',
        originalUrl: 'https://example.com/company.pdf',
        clicks: [
          { clickedAt: new Date('2026-07-12T01:00:00.000Z') },
          { clickedAt: new Date('2026-07-12T00:00:00.000Z') }
        ]
      }
    ]);
    const service = new TrackingService(prisma as any);

    await expect(service.getMailEngagement('mail_1')).resolves.toMatchObject({
      emailId: 'mail_1',
      materialViewed: true,
      materialClickCount: 2,
      appointmentAngle: 'interested',
      trackedLinks: [
        {
          label: 'company_material',
          trackingPath: '/t/click/token_1',
          clickCount: 2
        }
      ]
    });
  });
});
