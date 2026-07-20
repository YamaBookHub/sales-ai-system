import { TrackingService } from './tracking.service';

describe('TrackingService', () => {
  const createPrisma = () => {
    const prisma = {
    outreachEmail: {
      findFirst: jest.fn().mockResolvedValue({ id: 'mail_1', organizationId: 'org_1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'mail_1', organizationId: 'org_1' })
    },
    trackedLink: {
      create: jest.fn().mockResolvedValue({
        id: 'link_1',
        emailId: 'mail_1',
        token: 'token_1',
        originalUrl: 'https://example.com/company.pdf',
        label: 'company_material'
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue({
        id: 'link_1',
        emailId: 'mail_1',
        token: 'token_1',
        originalUrl: 'https://example.com/company.pdf',
        label: 'company_material',
        organizationId: 'org_1',
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
    },
    contactPerson: {
      findFirst: jest.fn().mockResolvedValue({ id: 'contact_1' }),
      update: jest.fn().mockResolvedValue({ id: 'contact_1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      auditLog: { create: jest.fn() }
    };
    return {
      ...prisma,
      $transaction: jest.fn(async (callback: (transaction: typeof prisma) => unknown) => callback(prisma))
    };
  };

  it('creates a company material tracked link', async () => {
    const prisma = createPrisma();
    const service = new TrackingService(prisma as any);

    const link = await service.createTrackedLink({
      emailId: 'mail_1',
      originalUrl: 'https://example.com/company.pdf',
      label: 'company_material'
    }, { organizationId: 'org_1', userId: 'user-1', sessionId: 'session-1' });

    expect(link.label).toBe('company_material');
    expect(link.trackingPath).toBe('/t/click/token_1');
    expect(prisma.trackedLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org_1',
        emailId: 'mail_1',
        originalUrl: 'https://example.com/company.pdf',
        label: 'company_material',
        token: expect.any(String)
      })
    });
  });

  it('records a tracked-link audit without retaining the original URL', async () => {
    const prisma = createPrisma();
    const service = new TrackingService(prisma as any);

    await service.createTrackedLink({
      emailId: 'mail_1',
      originalUrl: 'https://example.com/private.pdf',
      label: 'company_material'
    }, { organizationId: 'org_1', userId: 'user-1', sessionId: 'session-1' });

    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      organizationId: 'org_1',
      userId: 'user-1',
      sessionId: 'session-1',
      action: 'tracked_link.created',
      entityType: 'TrackedLink',
      entityId: 'link_1'
    });
    expect(JSON.stringify(audit)).not.toContain('private.pdf');
  });

  it('records material click and raises lead appointment angle', async () => {
    const prisma = createPrisma();
    const service = new TrackingService(prisma as any);

    await expect(service.resolveClick('token_1')).resolves.toBe('https://example.com/company.pdf');
    expect(prisma.linkClick.create).toHaveBeenCalledWith({ data: { organizationId: 'org_1', linkId: 'link_1' } });
    expect(prisma.emailEvent.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org_1',
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
      where: { organizationId_id: { organizationId: 'org_1', id: 'lead_1' } },
      data: expect.objectContaining({
        score: 85,
        priority: 'high',
        status: 'meeting_candidate',
        nextActionAt: expect.any(Date)
      })
    });
  });

  it('reuses an existing tracked link for the same mail and URL', async () => {
    const prisma = createPrisma();
    prisma.trackedLink.findFirst.mockResolvedValue({
      id: 'link_existing',
      emailId: 'mail_1',
      token: 'token_existing',
      originalUrl: 'https://example.com/company.pdf',
      label: 'company_material'
    });
    const service = new TrackingService(prisma as any);

    await expect(service.createTrackedLink({
      emailId: 'mail_1',
      originalUrl: 'https://example.com/company.pdf',
      label: 'company_material'
    }, { organizationId: 'org_1', userId: 'user-1', sessionId: 'session-1' })).resolves.toMatchObject({
      id: 'link_existing',
      trackingPath: '/t/click/token_existing'
    });
    expect(prisma.trackedLink.create).not.toHaveBeenCalled();
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

    await expect(service.getMailEngagement('org_1', 'mail_1')).resolves.toMatchObject({
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
    expect(prisma.trackedLink.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org_1', emailId: 'mail_1' }
    }));
  });

  it('unsubscribes a contact and clears its primary flag', async () => {
    const prisma = createPrisma();
    const service = new TrackingService(prisma as any);

    await expect(service.unsubscribe(
      { contactId: 'contact_1' },
      { organizationId: 'org_1', userId: 'user-1', sessionId: 'session-1' }
    )).resolves.toMatchObject({
      contactId: 'contact_1',
      isUnsubscribed: true
    });
    expect(prisma.contactPerson.update).toHaveBeenCalledWith({
      where: { organizationId_id: { organizationId: 'org_1', id: 'contact_1' } },
      data: {
        isUnsubscribed: true,
        unsubscribedAt: expect.any(Date),
        isPrimary: false
      }
    });
  });

  it('matches email case-insensitively and reports when no active contact was updated', async () => {
    const prisma = createPrisma();
    const service = new TrackingService(prisma as any);

    await expect(service.unsubscribe(
      { email: ' Contact@Example.COM ' },
      { organizationId: 'org_1', userId: 'user-1', sessionId: 'session-1' }
    )).resolves.toMatchObject({
      email: 'Contact@Example.COM',
      isUnsubscribed: true,
      updatedCount: 1
    });
    expect(prisma.contactPerson.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org_1',
        email: { equals: 'Contact@Example.COM', mode: 'insensitive' },
        deletedAt: null
      },
      data: {
        isUnsubscribed: true,
        unsubscribedAt: expect.any(Date),
        isPrimary: false
      }
    });

    prisma.contactPerson.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.unsubscribe(
      { email: 'missing@example.com' },
      { organizationId: 'org_1', userId: 'user-1', sessionId: 'session-1' }
    )).resolves.toMatchObject({
      isUnsubscribed: false,
      message: '一致する有効な連絡先が見つかりません。'
    });
  });
});
