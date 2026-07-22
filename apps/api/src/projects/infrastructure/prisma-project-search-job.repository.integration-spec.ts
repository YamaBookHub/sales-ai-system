import { PrismaClient } from '@prisma/client';
import { StoredProjectSearchJob } from '../domain/project-search-job';
import { PrismaProjectSearchJobRepository } from './prisma-project-search-job.repository';

const testDatabaseUrl = requireTestDatabaseUrl();

describe('PrismaProjectSearchJobRepository integration', () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let prismaA: PrismaClient;
  let prismaB: PrismaClient;
  let repositoryA: PrismaProjectSearchJobRepository;
  let repositoryB: PrismaProjectSearchJobRepository;
  let organizationAId: string;
  let organizationBId: string;
  let ownerAId: string;
  let ownerBId: string;

  beforeAll(async () => {
    prismaA = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    prismaB = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await Promise.all([prismaA.$connect(), prismaB.$connect()]);
    repositoryA = new PrismaProjectSearchJobRepository(prismaA as any);
    repositoryB = new PrismaProjectSearchJobRepository(prismaB as any);

    const [organizationA, organizationB, ownerA, ownerB] = await prismaA.$transaction(async (tx) => {
      const organizations = await Promise.all([
        tx.organization.create({ data: { slug: `search-job-a-${suffix}`, name: 'Search job A' } }),
        tx.organization.create({ data: { slug: `search-job-b-${suffix}`, name: 'Search job B' } })
      ]);
      const users = await Promise.all([
        tx.user.create({ data: { email: `search-job-a-${suffix}@example.test` } }),
        tx.user.create({ data: { email: `search-job-b-${suffix}@example.test` } })
      ]);
      await Promise.all([
        tx.organizationMembership.create({
          data: { organizationId: organizations[0].id, userId: users[0].id, role: 'operator' }
        }),
        tx.organizationMembership.create({
          data: { organizationId: organizations[1].id, userId: users[1].id, role: 'operator' }
        })
      ]);
      return [organizations[0], organizations[1], users[0], users[1]];
    });
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;
    ownerAId = ownerA.id;
    ownerBId = ownerB.id;
  });

  afterAll(async () => {
    if (!prismaA) return;
    await prismaA.projectSearchJob.deleteMany({ where: { organizationId: { in: [organizationAId, organizationBId] } } });
    await prismaA.organizationMembership.deleteMany({
      where: { organizationId: { in: [organizationAId, organizationBId] } }
    });
    await prismaA.organization.deleteMany({ where: { id: { in: [organizationAId, organizationBId] } } });
    await prismaA.user.deleteMany({ where: { id: { in: [ownerAId, ownerBId] } } });
    await Promise.all([prismaA.$disconnect(), prismaB.$disconnect()]);
  });

  it('shares progress across instances, isolates owners, and rejects a late worker write after cancel', async () => {
    const job = await repositoryA.create(buildJob());
    await expect(repositoryB.findOwned(job.id, organizationAId, ownerAId, new Date())).resolves.toMatchObject({
      id: job.id,
      status: 'running'
    });
    await expect(repositoryB.findOwned(job.id, organizationBId, ownerBId, new Date())).resolves.toBeNull();

    await expect(repositoryA.updateProgress(
      job.id,
      job.workerId,
      {
        searchedLimit: 20,
        items: [{ title: '共有候補', url: 'https://example.test/projects/shared' }],
        itemCount: 1,
        importableCount: 1,
        message: '共有進捗'
      },
      future(15_000),
      future(30 * 60_000)
    )).resolves.toBe(true);

    const cancelled = await repositoryB.requestCancel(
      job.id,
      organizationAId,
      ownerAId,
      '別インスタンスから停止',
      new Date(),
      future(30 * 60_000)
    );
    expect(cancelled).toMatchObject({ status: 'cancelled', itemCount: 1 });
    await expect(repositoryA.finish(job.id, job.workerId, {
      status: 'completed',
      items: [],
      itemCount: 0,
      importableCount: 0,
      completionReason: 'desired_reached',
      message: '遅延完了'
    }, future(30 * 60_000))).resolves.toBe(false);

    await expect(repositoryA.requestCancel(
      job.id,
      organizationAId,
      ownerAId,
      '再停止',
      new Date(),
      future(30 * 60_000)
    )).resolves.toMatchObject({ status: 'cancelled', message: '別インスタンスから停止' });
  });

  it('serializes concurrent starts and leaves only one running job for an owner', async () => {
    const [first, second] = await Promise.all([
      repositoryA.create(buildJob()),
      repositoryB.create(buildJob())
    ]);

    const rows = await prismaA.projectSearchJob.findMany({
      where: { id: { in: [first.id, second.id] } },
      orderBy: { startedAt: 'asc' }
    });
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.status === 'running')).toHaveLength(1);
    expect(rows.filter((row) => row.status === 'cancelled')).toHaveLength(1);
  });

  it('persists a lease-expired failure and removes only TTL-expired jobs', async () => {
    const job = await repositoryA.create(buildJob({
      leaseExpiresAt: new Date(Date.now() - 1),
      expiresAt: future(30 * 60_000)
    }));
    const failed = await repositoryB.failExpiredLease(
      job.id,
      organizationAId,
      ownerAId,
      new Date(),
      'worker lease expired',
      future(30 * 60_000)
    );
    expect(failed).toMatchObject({ status: 'failed', completionReason: 'failed' });

    await prismaA.projectSearchJob.update({
      where: { id: job.id },
      data: { expiresAt: new Date(Date.now() - 1) }
    });
    await expect(repositoryB.deleteExpired(new Date())).resolves.toBeGreaterThanOrEqual(1);
    await expect(repositoryA.findOwned(job.id, organizationAId, ownerAId, new Date())).resolves.toBeNull();
  });

  function buildJob(overrides: Partial<StoredProjectSearchJob> = {}): StoredProjectSearchJob {
    const now = new Date();
    return {
      id: crypto.randomUUID(),
      organizationId: organizationAId,
      ownerUserId: ownerAId,
      workerId: crypto.randomUUID(),
      status: 'running',
      source: 'campfire',
      request: { source: 'campfire', limit: 10 },
      desiredLimit: 10,
      searchedLimit: 0,
      items: [],
      itemCount: 0,
      importableCount: 0,
      message: '検索を開始しました',
      leaseExpiresAt: future(15_000),
      expiresAt: future(30 * 60_000),
      startedAt: now,
      updatedAt: now,
      ...overrides
    };
  }
});

function future(milliseconds: number) {
  return new Date(Date.now() + milliseconds);
}

function requireTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value || !/(^|[_-])test($|[_-])/i.test(new URL(value).pathname)) {
    throw new Error('TEST_DATABASE_URL must point to a dedicated test database.');
  }
  return value;
}
