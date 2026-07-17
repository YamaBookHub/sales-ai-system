import { PrismaClient } from '@prisma/client';
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
