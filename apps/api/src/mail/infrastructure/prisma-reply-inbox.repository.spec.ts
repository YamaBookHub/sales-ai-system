import { PrismaReplyInboxRepository } from './prisma-reply-inbox.repository';

describe('PrismaReplyInboxRepository', () => {
  function createRepository() {
    const prisma = {
      emailReply: {
        count: jest.fn(),
        findMany: jest.fn()
      }
    };
    return { prisma, repository: new PrismaReplyInboxRepository(prisma as any) };
  }

  it('applies filters, pagination, selected relations, and the 100-item limit', async () => {
    const { prisma, repository } = createRepository();
    const record = { id: 'reply_1', emailId: 'mail_1', email: { id: 'mail_1' } };
    prisma.emailReply.count.mockResolvedValue(101);
    prisma.emailReply.findMany.mockResolvedValue([record]);

    const result = await repository.list({
      page: 2,
      limit: 500,
      category: 'need_info',
      attention: 'needs_action',
      leadStatus: 'replied',
      sort: 'receivedAt',
      direction: 'asc'
    });

    expect(result).toMatchObject({ items: [record], page: 2, limit: 100, total: 101 });
    expect(prisma.emailReply.count).toHaveBeenCalledWith({ where: expect.objectContaining({ AND: expect.any(Array) }) });
    expect(prisma.emailReply.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 100,
      take: 100,
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
      select: expect.objectContaining({ email: expect.any(Object) })
    }));
  });

  it('sorts priority using the domain rank and restores the requested id order without duplicates', async () => {
    const { prisma, repository } = createRepository();
    prisma.emailReply.count.mockResolvedValue(3);
    prisma.emailReply.findMany
      .mockResolvedValueOnce([
        { id: 'reply_normal', category: 'need_info', receivedAt: new Date('2026-07-12T03:00:00.000Z') },
        { id: 'reply_complaint', category: 'complaint', receivedAt: new Date('2026-07-12T02:00:00.000Z') },
        { id: 'reply_stop', category: 'unsubscribe', receivedAt: new Date('2026-07-12T01:00:00.000Z') }
      ])
      .mockResolvedValueOnce([
        { id: 'reply_normal' },
        { id: 'reply_complaint' },
        { id: 'reply_stop' }
      ]);

    const result = await repository.list({ sort: 'priority', direction: 'desc' });

    expect(result.items.map((item) => item.id)).toEqual(['reply_complaint', 'reply_stop', 'reply_normal']);
    expect(new Set(result.items.map((item) => item.id)).size).toBe(result.items.length);
    expect(prisma.emailReply.findMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ['reply_complaint', 'reply_stop', 'reply_normal'] } },
      select: expect.any(Object)
    });
  });

  it('builds a stop-followup filter that includes category, blocked company, and unsubscribed contact', async () => {
    const { prisma, repository } = createRepository();
    prisma.emailReply.count.mockResolvedValue(0);
    prisma.emailReply.findMany.mockResolvedValue([]);

    await repository.list({ attention: 'stop_followup' });

    const where = prisma.emailReply.count.mock.calls[0][0].where;
    expect(where.AND[0].OR).toEqual(expect.arrayContaining([
      { category: { in: ['unsubscribe', 'not_interested'] } },
      { email: { is: { company: { is: { isBlocked: true } } } } },
      { email: { is: { contact: { is: { isUnsubscribed: true } } } } }
    ]));
  });
});
