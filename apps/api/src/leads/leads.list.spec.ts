import 'reflect-metadata';
import { Prisma } from '@prisma/client';
import { LeadsService } from './leads.service';

type FixtureLead = {
  id: string;
  company: { name: string; contacts: unknown[] };
  project: { title: string; platform: { type: string } };
  mails: Array<{ id: string; status: string; createdAt: Date }>;
  tasks: unknown[];
  _count: { tasks: number };
};

type Stats = {
  total: number;
  summaryTotal: number;
  noContact: number;
  draft: number;
  review: number;
  queued: number;
};

describe('LeadsService list', () => {
  const organizationId = 'org_1';
  const fixture = Array.from({ length: 201 }, (_, index) => lead(index + 1));
  const stableCreatedAtOrder = fixture.map((item) => item.id).reverse();

  it('reaches every ID in a 201-record dataset and preserves PostgreSQL page order during hydration', async () => {
    const { service, salesLead, transaction } = setup({ fixture, orderedIds: stableCreatedAtOrder });
    const received: string[] = [];

    for (let page = 1; page <= 21; page += 1) {
      const result = await service.list(organizationId, page, 10);
      received.push(...result.items.map((item) => item.id));
      expect(result.total).toBe(201);
    }

    expect(received).toEqual(stableCreatedAtOrder);
    expect(new Set(received).size).toBe(201);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead
    });
    expect(salesLead.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { organizationId, id: { in: stableCreatedAtOrder.slice(200) } },
      include: expect.objectContaining({
        mails: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { id: true, leadId: true, companyId: true, status: true, createdAt: true }
        },
        company: expect.objectContaining({
          include: expect.objectContaining({ contacts: expect.any(Object) })
        })
      })
    }));
  });

  it('keeps latest-mail filtering and summary counting in the database query without lead-ID arrays', async () => {
    const { service, queryRaw } = setup({
      fixture,
      orderedIds: stableCreatedAtOrder,
      stats: { total: 50, summaryTotal: 201, noContact: 10, draft: 20, review: 10, queued: 5 }
    });

    await service.list(organizationId, 2, 25, undefined, undefined, {
      keyword: 'needle',
      source: 'campfire',
      contactState: 'none',
      mailStatus: 'draft',
      nextAction: 'overdue',
      sort: 'amount',
      sortDirection: 'desc'
    });

    expect(queryRaw).toHaveBeenCalledTimes(2);
    const sql = queryRaw.mock.calls.map(([query]) => sqlText(query)).join('\n');
    const values = queryRaw.mock.calls.flatMap(([query]) => sqlValues(query));
    expect(sql).toContain('latest_mails AS');
    expect(sql).toContain('DISTINCT ON (mail."leadId")');
    expect(sql).toContain('"latestMailStatus" = $');
    expect(sql).toContain('ORDER BY "amount" DESC NULLS LAST, "id" DESC');
    expect(values).toEqual(expect.arrayContaining(['campfire', 'draft']));
    expect(values.some((value) => Array.isArray(value) && value.length > 100)).toBe(false);
  });

  it.each([
    ['company', '"companyName"'],
    ['project', '"projectTitle"'],
    ['amount', '"amount"'],
    ['supporters', '"supporterCount"'],
    ['daysLeft', '"daysLeft"'],
    ['score', '"score"'],
    ['createdAt', '"createdAt"']
  ])('uses the allowlisted %s ordering in PostgreSQL', async (sort, field) => {
    const { service, queryRaw } = setup({ fixture, orderedIds: stableCreatedAtOrder });

    await service.list(organizationId, 1, 20, undefined, undefined, { sort: sort as any, sortDirection: 'asc' });

    const pageQuery = queryRaw.mock.calls.map(([query]) => sqlText(query)).find((text) => text.includes('SELECT "id"'));
    expect(pageQuery).toContain(`ORDER BY ${field} ASC NULLS LAST, "id" ASC`);
  });

  it('sorts priority by low, medium, high rank instead of enum text', async () => {
    const { service, queryRaw } = setup({ fixture, orderedIds: stableCreatedAtOrder });

    await service.list(organizationId, 1, 20, undefined, undefined, { sort: 'priority', sortDirection: 'asc' });

    const pageQuery = queryRaw.mock.calls.map(([query]) => sqlText(query)).find((text) => text.includes('SELECT "id"'));
    expect(pageQuery).toContain('ORDER BY CASE "priority"');
    expect(pageQuery).toContain(`WHEN 'low'::"LeadPriority" THEN 1`);
    expect(pageQuery).toContain(`WHEN 'medium'::"LeadPriority" THEN 2`);
    expect(pageQuery).toContain(`WHEN 'high'::"LeadPriority" THEN 3`);
    expect(pageQuery).toContain('END ASC NULLS LAST, "id" ASC');
  });

  it('falls back to a safe created-at sort when list() is called outside DTO validation', async () => {
    const { service, queryRaw } = setup({ fixture, orderedIds: stableCreatedAtOrder });

    await service.list(organizationId, 1, 20, undefined, undefined, { sort: 'drop table' as any, sortDirection: 'desc' });

    const sql = queryRaw.mock.calls.map(([query]) => sqlText(query)).join('\n');
    expect(sql).toContain('ORDER BY "createdAt" DESC NULLS LAST, "id" DESC');
    expect(sql).not.toContain('drop table');
  });
});

function setup({
  fixture,
  orderedIds,
  stats = { total: fixture.length, summaryTotal: fixture.length, noContact: 0, draft: 0, review: 0, queued: 0 }
}: {
  fixture: FixtureLead[];
  orderedIds: string[];
  stats?: Stats;
}) {
  const queryRaw = jest.fn(async (query: unknown) => {
    const sql = sqlText(query);
    if (sql.includes('SELECT "id"')) {
      const values = sqlValues(query);
      const limit = Number(values.at(-2));
      const offset = Number(values.at(-1));
      return orderedIds.slice(offset, offset + limit).map((id) => ({ id }));
    }
    return [stats];
  });
  const salesLead = {
    findMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) => {
      // Prisma has no guaranteed IN-list order. Deliberately reverse it here to
      // verify that the service restores the SQL page order before returning.
      const records = where.id.in
        .map((id) => fixture.find((item) => item.id === id))
        .filter((item): item is FixtureLead => Boolean(item))
        .reverse();
      return Promise.resolve(records);
    })
  };
  const tx = { $queryRaw: queryRaw, salesLead };
  const transaction = jest.fn((callback: (client: typeof tx) => unknown) => callback(tx));
  const prisma = { $transaction: transaction };
  return { service: new LeadsService(prisma as any, {} as any), queryRaw, salesLead, transaction };
}

function lead(number: number): FixtureLead {
  return {
    id: `lead-${number}`,
    company: { name: `Company ${number}`, contacts: [] },
    project: { title: `Project ${number}`, platform: { type: 'campfire' } },
    mails: [{ id: `mail-${number}`, status: 'draft', createdAt: new Date('2026-07-18T00:00:00.000Z') }],
    tasks: [],
    _count: { tasks: 0 }
  };
}

function sqlText(query: unknown) {
  return (query as { strings?: readonly string[] }).strings?.join('$') || '';
}

function sqlValues(query: unknown) {
  return ((query as { values?: unknown[] }).values || []);
}
