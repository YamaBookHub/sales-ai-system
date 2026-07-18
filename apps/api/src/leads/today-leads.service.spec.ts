import { LeadsService } from './leads.service';

describe('LeadsService today list', () => {
  const now = new Date('2026-07-18T03:00:00.000Z');

  function lead(overrides: Record<string, unknown>) {
    return {
      id: 'lead_default',
      companyId: 'company_default',
      projectId: null,
      status: 'contacted',
      priority: 'medium',
      score: 0,
      reason: null,
      source: 'manual',
      ownerMemo: null,
      nextActionAt: null,
      nextFollowUpAt: null,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      deletedAt: null,
      company: { id: 'company_default', name: 'テスト会社' },
      project: null,
      scores: [],
      tasks: [],
      mails: [],
      _count: { tasks: 0 },
      ...overrides
    };
  }

  it('returns all actionable categories with server-side pagination and counts', async () => {
    const overdue = lead({
      id: 'lead_overdue',
      company: { id: 'company_overdue', name: '期限超過会社' },
      tasks: [{
        id: 'task_overdue', leadId: 'lead_overdue', title: '返信確認', description: null,
        status: 'todo', dueAt: new Date('2026-07-17T03:00:00.000Z'), doneAt: null,
        createdAt: new Date('2026-07-10T00:00:00.000Z'), updatedAt: new Date('2026-07-10T00:00:00.000Z'), assignee: null
      }],
      _count: { tasks: 1 }
    });
    const reply = lead({
      id: 'lead_reply',
      status: 'replied',
      company: { id: 'company_reply', name: '返信会社' },
      mails: [{ id: 'mail_reply', status: 'sent', createdAt: new Date('2026-07-17T00:00:00.000Z'), _count: { replies: 1 } }]
    });
    const prisma = { salesLead: { findMany: jest.fn().mockResolvedValue([reply, overdue]) } };
    const service = new LeadsService(prisma as any, {} as any);

    const firstPage = await service.listToday(1, 1, now);
    const secondPage = await service.listToday(2, 1, now);

    expect(firstPage).toMatchObject({
      page: 1,
      limit: 1,
      total: 2,
      counts: { overdue: 1, reply_received: 1 },
      items: [{ category: 'overdue', lead: { id: 'lead_overdue', nextTask: { id: 'task_overdue' } } }]
    });
    expect(secondPage.items).toMatchObject([{ category: 'reply_received', lead: { id: 'lead_reply' }, mail: { id: 'mail_reply' } }]);
    expect(prisma.salesLead.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: expect.any(Array) },
      include: expect.objectContaining({ tasks: expect.any(Object), mails: expect.any(Object) })
    }));
  });
});
