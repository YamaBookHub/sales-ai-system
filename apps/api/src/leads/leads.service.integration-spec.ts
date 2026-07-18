import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AnalyzeLeadUseCase } from '../ai/application/analyze-lead.usecase';
import { LeadsService } from './leads.service';

const testDatabaseUrl = requireTestDatabaseUrl();

describe('LeadsService detail editing integration', () => {
  let prisma: PrismaClient;
  let service: LeadsService;
  let analyzeLead: AnalyzeLeadUseCase;
  let leadId: string;
  let companyId: string;
  let projectId: string;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const projectUrl = `https://camp-fire.jp/projects/lead-edit-${suffix}/view`;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await prisma.$connect();
    const platform = await prisma.crowdfundingPlatform.upsert({
      where: { type_baseUrl: { type: 'campfire', baseUrl: 'https://camp-fire.jp' } },
      update: { isActive: true },
      create: { type: 'campfire', name: 'CAMPFIRE', baseUrl: 'https://camp-fire.jp' }
    });
    const company = await prisma.company.create({ data: { name: `編集前会社 ${suffix}` } });
    const project = await prisma.crowdfundingProject.create({
      data: {
        platformId: platform.id,
        companyId: company.id,
        title: '編集前案件',
        url: projectUrl,
        amount: 100,
        supporterCount: 1,
        scrapedAt: new Date('2026-07-01T00:00:00.000Z')
      }
    });
    const lead = await prisma.salesLead.create({
      data: { companyId: company.id, projectId: project.id, source: 'campfire' }
    });
    companyId = company.id;
    projectId = project.id;
    leadId = lead.id;
    service = new LeadsService(prisma as any, {} as any);
    analyzeLead = new AnalyzeLeadUseCase(prisma as any);
  });

  afterAll(async () => {
    if (leadId) {
      await prisma.aiGeneration.deleteMany({ where: { leadId } });
      await prisma.leadScore.deleteMany({ where: { leadId } });
      await prisma.salesLead.delete({ where: { id: leadId } });
    }
    if (projectId) await prisma.crowdfundingProject.delete({ where: { id: projectId } });
    if (companyId) await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it('round-trips manual company, project, lead, and analysis edits and preserves them after analysis', async () => {
    await service.update(leadId, {
      companyName: `編集後会社 ${suffix}`,
      companyWebsiteUrl: 'https://company.example.com',
      companyInquiryUrl: 'https://company.example.com/contact',
      companyIndustry: '食品',
      companyLocation: '鳥取',
      companySourceTotalAmount: 5000000,
      companySourceProjectCount: 6,
      companySourceSupporterCount: 186,
      companyMemo: '会社を人手で確認済み',
      projectTitle: '大山の伏流水で育つスモークサーモン',
      projectUrl,
      projectSource: 'campfire',
      projectStatus: 'active',
      projectAmount: 14515000,
      projectSupporterCount: 679,
      projectTargetAmount: 3000000,
      projectStartDate: '2026-07-01T00:00:00.000Z',
      projectEndDate: '2026-07-24T00:00:00.000Z',
      projectCategory: 'フード',
      projectLocation: '鳥取',
      projectDescription: '伏流水と職人技によるスモークサーモンです。',
      status: 'qualified',
      priority: 'high',
      nextActionAt: '2026-07-18T01:00:00.000Z',
      nextFollowUpAt: '2026-07-21T02:00:00.000Z',
      contactEmail: 'sales@example.com',
      contactFormUrl: 'https://company.example.com/contact',
      leadReason: '商品とSNS支援の親和性を確認',
      ownerMemo: '担当者が入力した営業メモ',
      brandAnalysisMemo: '担当者が入力した商品の魅力メモ',
      snsAnalysisMemo: '担当者が入力したSNSの見せ方'
    });

    const saved = await service.get(leadId);
    expect(saved).toMatchObject({
      status: 'qualified',
      priority: 'high',
      reason: '商品とSNS支援の親和性を確認',
      ownerMemo: '担当者が入力した営業メモ',
      brandAnalysisMemo: '担当者が入力した商品の魅力メモ',
      snsAnalysisMemo: '担当者が入力したSNSの見せ方',
      nextActionAt: new Date('2026-07-18T01:00:00.000Z'),
      nextFollowUpAt: new Date('2026-07-21T02:00:00.000Z'),
      company: {
        name: `編集後会社 ${suffix}`,
        websiteUrl: 'https://company.example.com',
        sourceProjectCount: 6
      },
      project: {
        title: '大山の伏流水で育つスモークサーモン',
        amount: 14515000,
        supporterCount: 679,
        targetAmount: 3000000,
        category: 'フード',
        location: '鳥取'
      }
    });

    await analyzeLead.execute(leadId);
    await expect(service.get(leadId)).resolves.toMatchObject({
      ownerMemo: '担当者が入力した営業メモ',
      brandAnalysisMemo: '担当者が入力した商品の魅力メモ',
      snsAnalysisMemo: '担当者が入力したSNSの見せ方'
    });

    await service.update(leadId, {
      companyWebsiteUrl: null,
      projectTargetAmount: null,
      projectEndDate: null,
      contactEmail: null,
      ownerMemo: null
    });
    await expect(service.get(leadId)).resolves.toMatchObject({
      contactEmail: null,
      ownerMemo: null,
      company: { websiteUrl: null },
      project: { targetAmount: null, endDate: null, daysLeft: null }
    });
  });

  it('uses PostgreSQL latest-mail semantics, filters, summaries, and stable relation sorting', async () => {
    const listSuffix = `list-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const fixtureCompanyIds: string[] = [];
    const fixtureProjectIds: string[] = [];
    const fixtureLeadIds: string[] = [];
    const fixtureContactIds: string[] = [];

    const createFixture = async ({
      label,
      amount,
      daysLeft,
      hasContact,
      mails
    }: {
      label: string;
      amount: number;
      daysLeft: number | null;
      hasContact: boolean;
      mails: Array<{ status: 'draft' | 'sent'; createdAt: Date }>;
    }) => {
      const company = await prisma.company.create({ data: { name: `一覧SQL ${label} ${listSuffix}` } });
      fixtureCompanyIds.push(company.id);
      const project = await prisma.crowdfundingProject.create({
        data: {
          platformId: (await prisma.crowdfundingPlatform.findFirstOrThrow({ where: { type: 'campfire' } })).id,
          companyId: company.id,
          title: `一覧SQL ${label} ${listSuffix}`,
          url: `https://camp-fire.jp/projects/list-${label}-${listSuffix}/view`,
          amount,
          supporterCount: amount / 10,
          daysLeft,
          scrapedAt: new Date('2026-07-01T00:00:00.000Z')
        }
      });
      fixtureProjectIds.push(project.id);
      const lead = await prisma.salesLead.create({ data: { companyId: company.id, projectId: project.id, source: 'campfire' } });
      fixtureLeadIds.push(lead.id);
      if (hasContact) {
        const contact = await prisma.contactPerson.create({
          data: { companyId: company.id, email: `${label}-${listSuffix}@example.com`, isPrimary: true }
        });
        fixtureContactIds.push(contact.id);
      }
      for (const mail of mails) {
        await prisma.outreachEmail.create({
          data: {
            companyId: company.id,
            leadId: lead.id,
            status: mail.status,
            subject: `${label} ${mail.status}`,
            body: 'integration fixture',
            createdAt: mail.createdAt
          }
        });
      }
      return lead;
    };

    try {
      const latestDraft = await createFixture({
        label: 'latest-draft',
        amount: 100,
        daysLeft: 5,
        hasContact: true,
        mails: [{ status: 'draft', createdAt: new Date('2026-07-15T00:00:00.000Z') }]
      });
      const oldDraftNowSent = await createFixture({
        label: 'old-draft-now-sent',
        amount: 200,
        daysLeft: null,
        hasContact: true,
        mails: [
          { status: 'draft', createdAt: new Date('2026-07-14T00:00:00.000Z') },
          { status: 'sent', createdAt: new Date('2026-07-16T00:00:00.000Z') }
        ]
      });
      const noMail = await createFixture({ label: 'no-mail', amount: 300, daysLeft: 10, hasContact: false, mails: [] });

      const base = await service.list(1, 20, undefined, undefined, {
        keyword: listSuffix,
        source: 'campfire',
        sort: 'amount',
        sortDirection: 'asc'
      });
      expect(base).toMatchObject({
        page: 1,
        limit: 20,
        total: 3,
        summary: { total: 3, noContact: 1, draft: 1, review: 0, queued: 0 }
      });
      expect(base.items.map((item) => item.id)).toEqual([latestDraft.id, oldDraftNowSent.id, noMail.id]);
      expect(base.items.map((item) => item.mails[0]?.status || null)).toEqual(['draft', 'sent', null]);

      const daysLeftAscending = await service.list(1, 20, undefined, undefined, {
        keyword: listSuffix,
        source: 'campfire',
        sort: 'daysLeft',
        sortDirection: 'asc'
      });
      expect(daysLeftAscending.items.map((item) => item.id)).toEqual([latestDraft.id, noMail.id, oldDraftNowSent.id]);

      const onlyDraft = await service.list(1, 20, undefined, undefined, {
        keyword: listSuffix,
        source: 'campfire',
        mailStatus: 'draft',
        sort: 'amount',
        sortDirection: 'asc'
      });
      expect(onlyDraft).toMatchObject({
        total: 1,
        summary: { total: 3, draft: 1 },
        items: [{ id: latestDraft.id, mails: [{ status: 'draft' }] }]
      });

      const noMailOnly = await service.list(1, 20, undefined, undefined, {
        keyword: listSuffix,
        source: 'campfire',
        mailStatus: 'none'
      });
      expect(noMailOnly).toMatchObject({ total: 1, items: [{ id: noMail.id, mails: [] }] });

      const contactsOnly = await service.list(1, 20, undefined, undefined, {
        keyword: listSuffix,
        source: 'campfire',
        contactState: 'has',
        sort: 'amount',
        sortDirection: 'asc'
      });
      expect(contactsOnly.items.map((item) => item.id)).toEqual([latestDraft.id, oldDraftNowSent.id]);
    } finally {
      await prisma.outreachEmail.deleteMany({ where: { leadId: { in: fixtureLeadIds } } });
      await prisma.contactPerson.deleteMany({ where: { id: { in: fixtureContactIds } } });
      await prisma.salesLead.deleteMany({ where: { id: { in: fixtureLeadIds } } });
      await prisma.crowdfundingProject.deleteMany({ where: { id: { in: fixtureProjectIds } } });
      await prisma.company.deleteMany({ where: { id: { in: fixtureCompanyIds } } });
    }
  });

  it('returns every record exactly once across server pages for a 201-lead dataset', async () => {
    const pageSuffix = `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const platform = await prisma.crowdfundingPlatform.findFirstOrThrow({ where: { type: 'campfire' } });
    const companies = Array.from({ length: 201 }, (_, index) => ({
      id: randomUUID(),
      name: `ページング会社 ${pageSuffix} ${String(index).padStart(3, '0')}`
    }));
    const projects = companies.map((company, index) => ({
      id: randomUUID(),
      platformId: platform.id,
      companyId: company.id,
      title: `ページング案件 ${pageSuffix} ${String(index).padStart(3, '0')}`,
      url: `https://camp-fire.jp/projects/${pageSuffix}-${index}/view`,
      amount: index,
      supporterCount: index,
      scrapedAt: new Date('2026-07-18T00:00:00.000Z')
    }));
    const leads = projects.map((project, index) => ({
      id: randomUUID(),
      companyId: project.companyId,
      projectId: project.id,
      source: 'campfire',
      createdAt: new Date(Date.UTC(2026, 6, 18, 0, 0, index))
    }));

    try {
      await prisma.company.createMany({ data: companies });
      await prisma.crowdfundingProject.createMany({ data: projects });
      await prisma.salesLead.createMany({ data: leads });

      const received: string[] = [];
      for (let page = 1; page <= 3; page += 1) {
        const result = await service.list(page, 100, undefined, undefined, {
          keyword: pageSuffix,
          source: 'campfire',
          sort: 'createdAt',
          sortDirection: 'desc'
        });
        expect(result.total).toBe(201);
        received.push(...result.items.map((item) => item.id));
      }

      expect(received).toEqual(leads.map((lead) => lead.id).reverse());
      expect(new Set(received).size).toBe(201);
    } finally {
      await prisma.salesLead.deleteMany({ where: { id: { in: leads.map((lead) => lead.id) } } });
      await prisma.crowdfundingProject.deleteMany({ where: { id: { in: projects.map((project) => project.id) } } });
      await prisma.company.deleteMany({ where: { id: { in: companies.map((company) => company.id) } } });
    }
  });
});

function requireTestDatabaseUrl() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error('TEST_DATABASE_URL is required. Run this suite with npm run test:integration.');
  const database = new URL(value).pathname.replace(/^\//, '');
  if (!/(^|[_-])test($|[_-])/i.test(database)) {
    throw new Error(`Refusing integration test against non-test database: ${database || '(empty)'}`);
  }
  return value;
}
