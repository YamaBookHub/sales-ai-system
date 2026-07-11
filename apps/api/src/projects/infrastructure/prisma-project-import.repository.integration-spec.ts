import { PrismaClient } from '@prisma/client';
import { NormalizedImportedProject } from '../domain/project-source-provider';
import { PrismaProjectImportRepository } from './prisma-project-import.repository';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDb = testDatabaseUrl ? describe : describe.skip;

describeWithDb('PrismaProjectImportRepository integration', () => {
  let prisma: PrismaClient;
  let repository: PrismaProjectImportRepository;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const projectUrl = `https://camp-fire.jp/projects/integration-${suffix}/view`;
  const companyName = `統合テスト株式会社 ${suffix}`;
  const platformBaseUrl = `https://camp-fire.jp/integration-${suffix}`;

  const imported: NormalizedImportedProject = {
    source: 'campfire',
    platform: {
      type: 'campfire',
      name: 'CAMPFIRE Integration',
      baseUrl: platformBaseUrl
    },
    company: {
      name: companyName,
      websiteUrl: `https://brand.example.com/${suffix}`,
      inquiryUrl: `https://brand.example.com/${suffix}/contact`,
      location: '東京',
      sourceTotalAmount: 1000000,
      sourceProjectCount: 2,
      sourceSupporterCount: 120,
      memo: 'integration memo'
    },
    project: {
      title: '統合テスト用スモークサーモン',
      url: projectUrl,
      status: 'active',
      amount: 1200000,
      supporterCount: 120,
      daysLeft: 7,
      description: '伏流水で仕込んだスモークサーモンです。',
      category: '食品',
      location: '東京',
      thumbnailUrl: `https://example.com/${suffix}/thumb.jpg`,
      scrapedAt: new Date('2026-07-11T00:00:00.000Z')
    },
    lead: {
      source: 'campfire',
      reason: '食品カテゴリの注目案件',
      contactFormUrl: `https://brand.example.com/${suffix}/contact`,
      brandWebsiteUrl: `https://brand.example.com/${suffix}`,
      instagramUrl: `https://instagram.com/${suffix}`,
      contactMemo: 'フォームあり',
      brandAnalysisMemo: '食卓で楽しめる点が強み'
    },
    raw: { ok: true }
  };

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl as string } }
    });
    repository = new PrismaProjectImportRepository(prisma as any);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { after: { path: ['projectUrl'], equals: projectUrl } } });
    await prisma.salesLead.deleteMany({ where: { project: { url: projectUrl } } });
    await prisma.crowdfundingProject.deleteMany({ where: { url: projectUrl } });
    await prisma.company.deleteMany({ where: { name: companyName } });
    await prisma.crowdfundingPlatform.deleteMany({ where: { baseUrl: platformBaseUrl } });
    await prisma.$disconnect();
  });

  it('persists platform, company, project, lead, and audit log in one real transaction', async () => {
    const result = await repository.persistImportedProject(imported, { bulk: true, userId: null });

    expect(result.platform.baseUrl).toBe(platformBaseUrl);
    expect(result.company.name).toBe(companyName);
    expect(result.project.url).toBe(projectUrl);
    expect(result.lead.status).toBe('qualified');

    const lead = await prisma.salesLead.findUnique({
      where: {
        companyId_projectId: {
          companyId: result.company.id,
          projectId: result.project.id
        }
      },
      include: { company: true, project: { include: { platform: true } } }
    });
    expect(lead?.company.name).toBe(companyName);
    expect(lead?.project?.platform.baseUrl).toBe(platformBaseUrl);
    expect(lead?.contactFormUrl).toBe(imported.lead.contactFormUrl);

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'projects.bulk_import.item',
        entityType: 'SalesLead',
        entityId: result.lead.id
      }
    });
    expect(audit?.after).toEqual(expect.objectContaining({
      source: 'campfire',
      platform: imported.platform.name,
      projectUrl
    }));
  });
});
