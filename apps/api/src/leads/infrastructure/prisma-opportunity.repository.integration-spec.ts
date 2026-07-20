import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { ensureOpportunityForLead, PrismaOpportunityRepository } from './prisma-opportunity.repository';

const testDatabaseUrl = requireTestDatabaseUrl();

describe('PrismaOpportunityRepository integration', () => {
  let prisma: PrismaClient;
  let concurrentPrisma: PrismaClient;
  let repository: PrismaOpportunityRepository;
  let concurrentRepository: PrismaOpportunityRepository;
  let platformId: string;
  let organizationId: string;
  let managerUserId: string;
  const fixtureIds = {
    company: [] as string[],
    project: [] as string[],
    lead: [] as string[]
  };
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    concurrentPrisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    repository = new PrismaOpportunityRepository(prisma as any);
    concurrentRepository = new PrismaOpportunityRepository(concurrentPrisma as any);
    await Promise.all([prisma.$connect(), concurrentPrisma.$connect()]);

    const platform = await prisma.crowdfundingPlatform.create({
      data: {
        type: 'campfire',
        name: `Opportunity統合テスト ${suffix}`,
        baseUrl: `https://opportunity-integration-${suffix}.example.com`
      }
    });
    platformId = platform.id;

    const organization = await prisma.organization.create({
      data: {
        slug: `opportunity-integration-${suffix}`,
        name: `Opportunity統合テスト組織 ${suffix}`
      }
    });
    organizationId = organization.id;
    const managerUser = await prisma.user.create({
      data: {
        email: `opportunity-manager-${suffix}@example.test`,
        name: 'Opportunity統合テスト管理者'
      }
    });
    managerUserId = managerUser.id;
    await prisma.organizationMembership.create({
      data: {
        organizationId,
        userId: managerUserId,
        role: 'manager'
      }
    });
  });

  afterAll(async () => {
    if (organizationId) {
      await prisma.auditLog.deleteMany({ where: { organizationId } });
      await prisma.opportunityStageHistory.deleteMany({ where: { organizationId } });
    }
    if (fixtureIds.lead.length > 0) {
      await prisma.task.deleteMany({ where: { organizationId, leadId: { in: fixtureIds.lead } } });
      await prisma.opportunity.deleteMany({ where: { organizationId, leadId: { in: fixtureIds.lead } } });
      await prisma.salesLead.deleteMany({ where: { organizationId, id: { in: fixtureIds.lead } } });
    }
    if (fixtureIds.project.length > 0) {
      await prisma.crowdfundingProject.deleteMany({ where: { organizationId, id: { in: fixtureIds.project } } });
    }
    if (fixtureIds.company.length > 0) {
      await prisma.company.deleteMany({ where: { organizationId, id: { in: fixtureIds.company } } });
    }
    if (organizationId && managerUserId) {
      await prisma.organizationMembership.deleteMany({ where: { organizationId, userId: managerUserId } });
      await prisma.user.deleteMany({ where: { id: managerUserId } });
      await prisma.organization.deleteMany({ where: { id: organizationId } });
    }
    if (platformId) {
      await prisma.crowdfundingPlatform.delete({ where: { id: platformId } });
    }
    await Promise.all([concurrentPrisma.$disconnect(), prisma.$disconnect()]);
  });

  it('creates one opportunity and its initial history for a lead', async () => {
    const leadId = await createLead('initial');

    const first = await prisma.$transaction((tx) => ensureOpportunityForLead(tx, leadId, organizationId));
    const second = await prisma.$transaction((tx) => ensureOpportunityForLead(tx, leadId, organizationId));
    const opportunity = await prisma.opportunity.findUniqueOrThrow({
      where: { organizationId_leadId: { organizationId, leadId } },
      include: {
        history: {
          orderBy: { createdAt: 'asc' },
          include: { changedBy: { include: { user: true } } }
        }
      }
    });

    expect(second.id).toBe(first.id);
    expect(opportunity).toMatchObject({ id: first.id, leadId, stage: 'uncontacted', version: 1 });
    expect(opportunity.history).toHaveLength(1);
    expect(opportunity.history[0]).toMatchObject({
      fromStage: null,
      toStage: 'uncontacted',
      source: 'system',
      sourceId: leadId,
      operationKey: `bootstrap:opportunity:${leadId}`,
      versionAfter: 1
    });
  });

  it('persists normal transitions and append-only stage history', async () => {
    const leadId = await createLead('normal-transition');
    await ensureForTest(leadId);

    await repository.transition(leadId, {
      expectedVersion: 1,
      operationKey: randomUUID(),
      toStage: 'contacted',
      reason: '初回メールを手動送信'
    }, manager());
    await repository.transition(leadId, {
      expectedVersion: 2,
      operationKey: randomUUID(),
      toStage: 'replied',
      reason: '返信を確認'
    }, manager());

    const opportunity = await prisma.opportunity.findUniqueOrThrow({
      where: { organizationId_leadId: { organizationId, leadId } },
      include: {
        history: {
          orderBy: { createdAt: 'asc' },
          include: { changedBy: { include: { user: true } } }
        }
      }
    });
    expect(opportunity).toMatchObject({ stage: 'replied', probability: 25, version: 3 });
    expect(opportunity.history.map((item) => [item.fromStage, item.toStage])).toEqual([
      [null, 'uncontacted'],
      ['uncontacted', 'contacted'],
      ['contacted', 'replied']
    ]);
    expect(opportunity.history.slice(1).every((item) => item.source === 'manual')).toBe(true);
    expect(opportunity.history.slice(1).every((item) => item.changedBy?.userId === managerUserId)).toBe(true);
  });

  it('persists the loss reason and its detail', async () => {
    const leadId = await createLead('lost-reason');
    await ensureForTest(leadId);
    await repository.transition(leadId, {
      expectedVersion: 1,
      operationKey: randomUUID(),
      toStage: 'contacted',
      reason: '連絡済み'
    }, manager());

    await repository.transition(leadId, {
      expectedVersion: 2,
      operationKey: randomUUID(),
      toStage: 'lost',
      reason: '今回は他社へ依頼',
      lossReason: 'other',
      lossReasonDetail: '既存の取引先を継続'
    }, manager());

    const opportunity = await prisma.opportunity.findUniqueOrThrow({
      where: { organizationId_leadId: { organizationId, leadId } },
      include: { history: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });
    expect(opportunity).toMatchObject({
      stage: 'lost',
      lossReason: 'other',
      lossReasonDetail: '既存の取引先を継続',
      probability: 0
    });
    expect(opportunity.lostAt).not.toBeNull();
    expect(opportunity.history[0].snapshot).toEqual(expect.objectContaining({
      stage: 'lost',
      lossReason: 'other',
      lossReasonDetail: '既存の取引先を継続'
    }));
  });

  it('rejects one of two concurrent transitions with a stale expectedVersion', async () => {
    const leadId = await createLead('version-conflict');
    await ensureForTest(leadId);

    const results = await Promise.allSettled([
      repository.transition(leadId, {
        expectedVersion: 1,
        operationKey: randomUUID(),
        toStage: 'contacted',
        reason: '同時操作A'
      }, manager()),
      concurrentRepository.transition(leadId, {
        expectedVersion: 1,
        operationKey: randomUUID(),
        toStage: 'contacted',
        reason: '同時操作B'
      }, manager())
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toBeDefined();
    expect((rejected as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    await expect(prisma.opportunity.findUniqueOrThrow({
      where: { organizationId_leadId: { organizationId, leadId } }
    })).resolves.toMatchObject({
      stage: 'contacted',
      version: 2
    });
  });

  it('treats a repeated operationKey as idempotent', async () => {
    const leadId = await createLead('idempotency');
    await ensureForTest(leadId);
    const operationKey = randomUUID();
    const input = {
      expectedVersion: 1,
      operationKey,
      toStage: 'contacted' as const,
      reason: '重複しない状態遷移'
    };

    const first = await repository.transition(leadId, input, manager());
    const repeated = await repository.transition(leadId, input, manager());
    const historyCount = await prisma.opportunityStageHistory.count({
      where: { organizationId, opportunity: { organizationId, leadId } }
    });

    expect(repeated.id).toBe(first.id);
    expect(repeated.version).toBe(2);
    expect(historyCount).toBe(2);
  });

  it('rejects a repeated operationKey when the request contents differ', async () => {
    const leadId = await createLead('idempotency-conflict');
    await ensureForTest(leadId);
    const operationKey = randomUUID();

    await repository.transition(leadId, {
      expectedVersion: 1,
      operationKey,
      toStage: 'contacted',
      reason: '最初の操作'
    }, manager());

    await expect(repository.transition(leadId, {
      expectedVersion: 1,
      operationKey,
      toStage: 'contacted',
      reason: '異なる操作内容'
    }, manager())).rejects.toMatchObject({ status: 409 });
  });

  it('does not expose or update an opportunity whose lead is logically deleted', async () => {
    const leadId = await createLead('soft-deleted');
    await ensureForTest(leadId);
    await prisma.salesLead.update({
      where: { organizationId_id: { organizationId, id: leadId } },
      data: { deletedAt: new Date() }
    });

    await expect(repository.getByLeadId(organizationId, leadId)).rejects.toMatchObject({ status: 404 });
    await expect(repository.transition(leadId, {
      expectedVersion: 1,
      operationKey: randomUUID(),
      toStage: 'contacted',
      reason: '削除済み案件を更新'
    }, manager())).rejects.toMatchObject({ status: 404 });
  });

  it('clears lead follow-up dates and cancels active tasks on a terminal transition', async () => {
    const leadId = await createLead('terminal-cleanup');
    const tasks = await Promise.all([
      prisma.task.create({ data: { organizationId, leadId, title: '未完了タスク', status: 'todo' } }),
      prisma.task.create({ data: { organizationId, leadId, title: '進行中タスク', status: 'doing' } }),
      prisma.task.create({ data: { organizationId, leadId, title: '完了済みタスク', status: 'done', doneAt: new Date() } })
    ]);
    await ensureForTest(leadId);
    await repository.transition(leadId, {
      expectedVersion: 1,
      operationKey: randomUUID(),
      toStage: 'contacted',
      reason: '送信済み'
    }, manager());
    await repository.transition(leadId, {
      expectedVersion: 2,
      operationKey: randomUUID(),
      toStage: 'lost',
      reason: '営業対象から除外',
      lossReason: 'no_interest'
    }, manager());

    const [lead, persistedTasks] = await Promise.all([
      prisma.salesLead.findUniqueOrThrow({ where: { organizationId_id: { organizationId, id: leadId } } }),
      prisma.task.findMany({
        where: { organizationId, id: { in: tasks.map((task) => task.id) } },
        orderBy: { title: 'asc' }
      })
    ]);
    expect(lead).toMatchObject({ nextActionAt: null, nextFollowUpAt: null });
    expect(persistedTasks.find((task) => task.title === '未完了タスク')?.status).toBe('cancelled');
    expect(persistedTasks.find((task) => task.title === '進行中タスク')?.status).toBe('cancelled');
    expect(persistedTasks.find((task) => task.title === '完了済みタスク')?.status).toBe('done');
  });

  it('removes opportunity and history when its lead is deleted', async () => {
    const leadId = await createLead('cascade-cleanup');
    await ensureForTest(leadId);
    await repository.transition(leadId, {
      expectedVersion: 1,
      operationKey: randomUUID(),
      toStage: 'contacted',
      reason: 'cascade確認'
    }, manager());

    const opportunity = await prisma.opportunity.findUniqueOrThrow({
      where: { organizationId_leadId: { organizationId, leadId } }
    });
    await prisma.salesLead.delete({ where: { organizationId_id: { organizationId, id: leadId } } });

    await expect(prisma.opportunity.findUnique({
      where: { organizationId_id: { organizationId, id: opportunity.id } }
    })).resolves.toBeNull();
    await expect(prisma.opportunityStageHistory.count({
      where: { organizationId, opportunityId: opportunity.id }
    })).resolves.toBe(0);
  });

  async function createLead(label: string) {
    const company = await prisma.company.create({
      data: { organizationId, name: `Opportunity ${label} ${suffix}` }
    });
    const project = await prisma.crowdfundingProject.create({
      data: {
        organizationId,
        platformId,
        companyId: company.id,
        title: `Opportunity統合テスト案件 ${label}`,
        url: `https://camp-fire.jp/projects/opportunity-${label}-${suffix}/view`,
        status: 'active',
        amount: 100000,
        supporterCount: 10,
        daysLeft: 10
      }
    });
    const lead = await prisma.salesLead.create({
      data: {
        organizationId,
        companyId: company.id,
        projectId: project.id,
        source: 'integration-test',
        nextActionAt: new Date('2026-07-20T01:00:00.000Z'),
        nextFollowUpAt: new Date('2026-07-21T01:00:00.000Z')
      }
    });
    fixtureIds.company.push(company.id);
    fixtureIds.project.push(project.id);
    fixtureIds.lead.push(lead.id);
    return lead.id;
  }

  async function ensureForTest(leadId: string) {
    return prisma.$transaction((tx) => ensureOpportunityForLead(tx, leadId, organizationId));
  }

  function manager() {
    return { userId: managerUserId, organizationId, role: 'manager' as const };
  }
});

function requireTestDatabaseUrl() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) {
    throw new Error('TEST_DATABASE_URL is required. Run this suite with npm run test:integration.');
  }
  const database = new URL(value).pathname.replace(/^\//, '');
  if (!/(^|[_-])test($|[_-])/i.test(database)) {
    throw new Error(`Refusing integration test against non-test database: ${database || '(empty)'}`);
  }
  return value;
}
