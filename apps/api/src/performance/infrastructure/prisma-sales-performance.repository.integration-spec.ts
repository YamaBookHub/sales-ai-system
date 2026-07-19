import { PrismaClient } from '@prisma/client';
import { PrismaSalesPerformanceRepository } from './prisma-sales-performance.repository';

const testDatabaseUrl = requireTestDatabaseUrl();

describe('PrismaSalesPerformanceRepository integration', () => {
  let prisma: PrismaClient;
  let repository: PrismaSalesPerformanceRepository;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ids = {
    users: [] as string[],
    platforms: [] as string[],
    companies: [] as string[],
    projects: [] as string[],
    leads: [] as string[],
    mails: [] as string[]
  };
  let ownerA: string;
  let ownerB: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    repository = new PrismaSalesPerformanceRepository(prisma as any);
    await prisma.$connect();
    const fixtures = await createFixtures(prisma, suffix, ids);
    ownerA = fixtures.ownerA;
    ownerB = fixtures.ownerB;
  });

  afterAll(async () => {
    await prisma.emailReply.deleteMany({ where: { emailId: { in: ids.mails } } });
    await prisma.emailEvent.deleteMany({ where: { emailId: { in: ids.mails } } });
    await prisma.outreachEmail.deleteMany({ where: { id: { in: ids.mails } } });
    await prisma.opportunityStageHistory.deleteMany({ where: { opportunity: { leadId: { in: ids.leads } } } });
    await prisma.opportunity.deleteMany({ where: { leadId: { in: ids.leads } } });
    await prisma.salesLead.deleteMany({ where: { id: { in: ids.leads } } });
    await prisma.crowdfundingProject.deleteMany({ where: { id: { in: ids.projects } } });
    await prisma.company.deleteMany({ where: { id: { in: ids.companies } } });
    await prisma.crowdfundingPlatform.deleteMany({ where: { id: { in: ids.platforms } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    await prisma.$disconnect();
  });

  it('aggregates a known sent cohort without duplicate events or end-boundary leakage', async () => {
    const result = await repository.summarize(period());

    expect(result).toEqual({
      sentMessages: 4,
      contactedLeads: 4,
      repliedLeads: 2,
      meetingLeads: 2,
      wonLeads: 1,
      lostLeads: 1,
      lossReasonCounts: { no_budget: 1 }
    });
  });

  it('applies the current owner filter to every metric', async () => {
    const result = await repository.summarize({ ...period(), ownerId: ownerA });

    expect(result).toMatchObject({
      sentMessages: 3,
      contactedLeads: 3,
      repliedLeads: 1,
      meetingLeads: 1,
      wonLeads: 1,
      lostLeads: 1
    });
    expect(ownerB).not.toBe(ownerA);
  });

  it('lists inactive owners that still own performance records', async () => {
    const owners = await repository.listOwners();

    expect(owners).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: ownerA, isActive: true }),
      expect.objectContaining({ id: ownerB, isActive: false })
    ]));
  });

  it('filters the acquisition source, including manually registered leads', async () => {
    const campfire = await repository.summarize({ ...period(), source: 'campfire' });
    const manual = await repository.summarize({ ...period(), source: 'manual' });

    expect(campfire).toMatchObject({ sentMessages: 2, contactedLeads: 2, wonLeads: 1, lostLeads: 1 });
    expect(manual).toMatchObject({ sentMessages: 1, contactedLeads: 1, repliedLeads: 0 });
  });

  it('uses inclusive Tokyo dates and returns zero-safe counts outside the cohort', async () => {
    const firstDay = await repository.summarize({
      startUtc: new Date('2097-02-28T15:00:00.000Z'),
      endExclusiveUtc: new Date('2097-03-01T15:00:00.000Z')
    });
    const empty = await repository.summarize({
      startUtc: new Date('2097-04-01T15:00:00.000Z'),
      endExclusiveUtc: new Date('2097-04-02T15:00:00.000Z')
    });

    expect(firstDay.sentMessages).toBe(1);
    expect(empty).toEqual({
      sentMessages: 0,
      contactedLeads: 0,
      repliedLeads: 0,
      meetingLeads: 0,
      wonLeads: 0,
      lostLeads: 0,
      lossReasonCounts: {}
    });
  });
});

function period() {
  return {
    startUtc: new Date('2097-02-28T15:00:00.000Z'),
    endExclusiveUtc: new Date('2097-03-31T15:00:00.000Z')
  };
}

async function createFixtures(
  prisma: PrismaClient,
  suffix: string,
  ids: {
    users: string[];
    platforms: string[];
    companies: string[];
    projects: string[];
    leads: string[];
    mails: string[];
  }
) {
  const [ownerARecord, ownerBRecord] = await Promise.all([
    prisma.user.create({ data: { email: `metrics-owner-a-${suffix}@example.com`, name: '集計担当A' } }),
    prisma.user.create({ data: { email: `metrics-owner-b-${suffix}@example.com`, name: '集計担当B', isActive: false } })
  ]);
  ids.users.push(ownerARecord.id, ownerBRecord.id);

  const [campfire, makuake] = await Promise.all([
    prisma.crowdfundingPlatform.create({
      data: { type: 'campfire', name: `集計CAMPFIRE ${suffix}`, baseUrl: `https://metrics-campfire-${suffix}.example.com` }
    }),
    prisma.crowdfundingPlatform.create({
      data: { type: 'makuake', name: `集計Makuake ${suffix}`, baseUrl: `https://metrics-makuake-${suffix}.example.com` }
    })
  ]);
  ids.platforms.push(campfire.id, makuake.id);

  const won = await createLeadFixture(prisma, ids, suffix, 'won', campfire.id, ownerARecord.id, 'won');
  const lost = await createLeadFixture(prisma, ids, suffix, 'lost', campfire.id, ownerARecord.id, 'lost');
  const meeting = await createLeadFixture(prisma, ids, suffix, 'meeting', makuake.id, ownerBRecord.id, 'meeting');
  const manual = await createLeadFixture(prisma, ids, suffix, 'manual', null, ownerARecord.id, 'contacted');

  await prisma.opportunityStageHistory.create({
    data: {
      opportunityId: lost.opportunityId,
      fromStage: 'contacted',
      toStage: 'meeting',
      source: 'manual',
      versionAfter: 1,
      createdAt: new Date('2097-03-10T03:00:00.000Z')
    }
  });

  await Promise.all([
    createSentMail(prisma, ids, won.leadId, won.companyId, '2097-02-28T15:00:00.000Z', true, 'won', '2097-04-20T03:00:00.000Z', true),
    createSentMail(prisma, ids, lost.leadId, lost.companyId, '2097-03-15T03:00:00.000Z', false),
    createSentMail(prisma, ids, meeting.leadId, meeting.companyId, '2097-03-31T14:59:59.000Z', true),
    createSentMail(prisma, ids, manual.leadId, manual.companyId, '2097-03-20T03:00:00.000Z', false),
    createSentMail(prisma, ids, won.leadId, won.companyId, '2097-02-28T14:59:59.000Z', false, 'outside-period', '2097-03-02T03:00:00.000Z'),
    createSentMail(prisma, ids, manual.leadId, manual.companyId, '2097-03-31T15:00:00.000Z', false, 'end-exclusive')
  ]);

  return { ownerA: ownerARecord.id, ownerB: ownerBRecord.id };
}

async function createLeadFixture(
  prisma: PrismaClient,
  ids: { companies: string[]; projects: string[]; leads: string[] },
  suffix: string,
  key: string,
  platformId: string | null,
  ownerId: string,
  stage: 'contacted' | 'meeting' | 'won' | 'lost'
) {
  const company = await prisma.company.create({ data: { name: `集計会社-${key}-${suffix}` } });
  ids.companies.push(company.id);
  const project = platformId
    ? await prisma.crowdfundingProject.create({
        data: {
          platformId,
          companyId: company.id,
          title: `集計案件-${key}-${suffix}`,
          url: `https://metrics-project-${key}-${suffix}.example.com`
        }
      })
    : null;
  if (project) ids.projects.push(project.id);
  const lead = await prisma.salesLead.create({
    data: { companyId: company.id, projectId: project?.id, source: platformId ? 'integration' : 'manual' }
  });
  ids.leads.push(lead.id);
  const opportunity = await prisma.opportunity.create({
    data: {
      leadId: lead.id,
      ownerId,
      stage,
      probability: stage === 'won' ? 100 : stage === 'lost' ? 0 : stage === 'meeting' ? 50 : 10,
      wonAmount: stage === 'won' ? 500000 : null,
      wonAt: stage === 'won' ? new Date('2097-04-10T03:00:00.000Z') : null,
      lostAt: stage === 'lost' ? new Date('2097-04-11T03:00:00.000Z') : null,
      lossReason: stage === 'lost' ? 'no_budget' : null,
      stageChangedAt: new Date('2097-04-11T03:00:00.000Z')
    }
  });
  const histories = stage === 'won'
    ? [
        { toStage: 'meeting' as const, versionAfter: 2, createdAt: new Date('2097-04-05T03:00:00.000Z') },
        { toStage: 'won' as const, versionAfter: 3, createdAt: new Date('2097-04-10T03:00:00.000Z') }
      ]
    : stage === 'meeting'
      ? [{ toStage: 'meeting' as const, versionAfter: 2, createdAt: new Date('2097-04-06T03:00:00.000Z') }]
      : [];
  for (const history of histories) {
    await prisma.opportunityStageHistory.create({
      data: { opportunityId: opportunity.id, fromStage: 'contacted', source: 'manual', ...history }
    });
  }
  return { companyId: company.id, leadId: lead.id, opportunityId: opportunity.id };
}

async function createSentMail(
  prisma: PrismaClient,
  ids: { mails: string[] },
  leadId: string,
  companyId: string,
  sentAt: string,
  replied: boolean,
  key = Math.random().toString(16).slice(2),
  eventCreatedAt = sentAt,
  duplicateSentEvent = false
) {
  const date = new Date(sentAt);
  const mail = await prisma.outreachEmail.create({
    data: {
      leadId,
      companyId,
      status: 'sent',
      subject: `集計メール-${key}`,
      body: '集計テスト本文',
      sentAt: date
    }
  });
  ids.mails.push(mail.id);
  await prisma.emailEvent.create({ data: { emailId: mail.id, type: 'sent', createdAt: new Date(eventCreatedAt) } });
  if (duplicateSentEvent) {
    await prisma.emailEvent.create({ data: { emailId: mail.id, type: 'sent', createdAt: new Date(eventCreatedAt) } });
  }
  if (replied) {
    await prisma.emailReply.create({
      data: {
        emailId: mail.id,
        body: '返信です',
        bodyText: '返信です',
        category: 'interested',
        receivedAt: new Date('2097-04-02T03:00:00.000Z')
      }
    });
    await prisma.emailReply.create({
      data: {
        emailId: mail.id,
        body: '追加返信です',
        bodyText: '追加返信です',
        category: 'need_info',
        receivedAt: new Date('2097-04-03T03:00:00.000Z')
      }
    });
  }
}

function requireTestDatabaseUrl() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error('TEST_DATABASE_URL is required. Run this suite with npm run test:integration.');
  const database = new URL(value).pathname.replace(/^\//, '');
  if (!/(^|[_-])test($|[_-])/i.test(database)) {
    throw new Error(`Refusing integration test against non-test database: ${database || '(empty)'}`);
  }
  return value;
}
