import { PrismaClient } from '@prisma/client';
import { NormalizedImportedProject } from '../domain/project-source-provider';
import { PrismaProjectImportRepository } from './prisma-project-import.repository';

const testDatabaseUrl = requireTestDatabaseUrl();

describe('PrismaProjectImportRepository integration', () => {
  let prisma: PrismaClient;
  let concurrentPrisma: PrismaClient;
  let repository: PrismaProjectImportRepository;
  let concurrentRepository: PrismaProjectImportRepository;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const projectUrl = `https://camp-fire.jp/projects/integration-${suffix}/view`;
  const companyName = `統合テスト株式会社 ${suffix}`;
  const platformBaseUrl = `https://camp-fire.jp/integration-${suffix}`;
  const concurrentProjectUrl = `https://camp-fire.jp/projects/concurrent-${suffix}/view`;
  const sharedCompanyName = `並列会社株式会社 ${suffix}`;
  const sharedCompanyProjectUrls = [
    `https://camp-fire.jp/projects/shared-a-${suffix}/view`,
    `https://camp-fire.jp/projects/shared-b-${suffix}/view`
  ];
  const partialCompanyName = `部分失敗株式会社 ${suffix}`;
  const successfulPartialProjectUrl = `https://camp-fire.jp/projects/partial-success-${suffix}/view`;
  const failedPartialProjectUrl = `https://camp-fire.jp/projects/partial-failure-${suffix}/view`;
  const testProjectUrls = [
    projectUrl,
    concurrentProjectUrl,
    ...sharedCompanyProjectUrls,
    successfulPartialProjectUrl,
    failedPartialProjectUrl
  ];
  const testCompanyNames = [companyName, sharedCompanyName, partialCompanyName];

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
    concurrentPrisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl as string } }
    });
    repository = new PrismaProjectImportRepository(prisma as any);
    concurrentRepository = new PrismaProjectImportRepository(concurrentPrisma as any);
    await prisma.$connect();
    await concurrentPrisma.$connect();
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: {
        OR: testProjectUrls.map((url) => ({ after: { path: ['projectUrl'], equals: url } }))
      }
    });
    await prisma.salesLead.deleteMany({ where: { project: { url: { in: testProjectUrls } } } });
    await prisma.crowdfundingProject.deleteMany({ where: { url: { in: testProjectUrls } } });
    await prisma.company.deleteMany({ where: { name: { in: testCompanyNames } } });
    await prisma.crowdfundingPlatform.deleteMany({ where: { baseUrl: platformBaseUrl } });
    await concurrentPrisma.$disconnect();
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

  it('serializes concurrent imports of the same normalized URL without duplicate company, project, or lead rows', async () => {
    const concurrentImport = buildImportedProject({
      projectUrl: `${concurrentProjectUrl}?utm=first`,
      companyName: `  ${sharedCompanyName}  `,
      platformBaseUrl
    });
    const duplicateImport = buildImportedProject({
      projectUrl: `${concurrentProjectUrl}?utm=second#top`,
      companyName: sharedCompanyName,
      platformBaseUrl
    });

    const [first, second] = await Promise.all([
      repository.persistImportedProject(concurrentImport, { bulk: true, userId: null }),
      concurrentRepository.persistImportedProject(duplicateImport, { bulk: true, userId: null })
    ]);

    expect(first.company.id).toBe(second.company.id);
    expect(first.project.id).toBe(second.project.id);
    expect(first.lead.id).toBe(second.lead.id);
    await expectImportedRowCounts({ projectUrls: [concurrentProjectUrl], companyName: sharedCompanyName, projects: 1, leads: 1 });
  });

  it('serializes concurrent imports of different URLs for the same company', async () => {
    const [first, second] = await Promise.all(
      sharedCompanyProjectUrls.map((url, index) =>
        (index === 0 ? repository : concurrentRepository).persistImportedProject(
          buildImportedProject({ projectUrl: url, companyName: sharedCompanyName, platformBaseUrl }),
          { bulk: true, userId: null }
        )
      )
    );

    expect(first.company.id).toBe(second.company.id);
    await expectImportedRowCounts({
      projectUrls: sharedCompanyProjectUrls,
      companyName: sharedCompanyName,
      projects: 2,
      leads: 2
    });
  });

  it('rolls back a failed item without affecting a concurrent successful item', async () => {
    const results = await Promise.allSettled([
      repository.persistImportedProject(
        buildImportedProject({ projectUrl: successfulPartialProjectUrl, companyName: partialCompanyName, platformBaseUrl }),
        { bulk: true, userId: null }
      ),
      concurrentRepository.persistImportedProject(
        buildImportedProject({ projectUrl: failedPartialProjectUrl, companyName: partialCompanyName, platformBaseUrl }),
        { bulk: true, userId: 'not-a-uuid' }
      )
    ]);

    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    await expectImportedRowCounts({
      projectUrls: [successfulPartialProjectUrl, failedPartialProjectUrl],
      companyName: partialCompanyName,
      projects: 1,
      leads: 1
    });
    await expect(prisma.crowdfundingProject.findUnique({ where: { url: failedPartialProjectUrl } })).resolves.toBeNull();
  });

  async function expectImportedRowCounts(input: { projectUrls: string[]; companyName: string; projects: number; leads: number }) {
    const [companyCount, projectCount, leadCount] = await Promise.all([
      prisma.company.count({ where: { normalizedName: input.companyName.trim().toLowerCase(), deletedAt: null } }),
      prisma.crowdfundingProject.count({ where: { url: { in: input.projectUrls } } }),
      prisma.salesLead.count({ where: { project: { url: { in: input.projectUrls } } } })
    ]);

    expect(companyCount).toBe(1);
    expect(projectCount).toBe(input.projects);
    expect(leadCount).toBe(input.leads);
  }
});

function buildImportedProject(input: { projectUrl: string; companyName: string; platformBaseUrl: string }): NormalizedImportedProject {
  return {
    source: 'campfire',
    platform: {
      type: 'campfire',
      name: 'CAMPFIRE Integration',
      baseUrl: input.platformBaseUrl
    },
    company: {
      name: input.companyName,
      websiteUrl: 'https://brand.example.com/integration',
      inquiryUrl: 'https://brand.example.com/integration/contact',
      location: '東京',
      sourceTotalAmount: 1000000,
      sourceProjectCount: 2,
      sourceSupporterCount: 120,
      memo: 'integration memo'
    },
    project: {
      title: '統合テスト用スモークサーモン',
      url: input.projectUrl,
      status: 'active',
      amount: 1200000,
      supporterCount: 120,
      daysLeft: 7,
      description: '伏流水で仕込んだスモークサーモンです。',
      category: '食品',
      location: '東京',
      thumbnailUrl: 'https://example.com/integration/thumb.jpg',
      scrapedAt: new Date('2026-07-11T00:00:00.000Z')
    },
    lead: {
      source: 'campfire',
      reason: '食品カテゴリの注目案件',
      contactFormUrl: 'https://brand.example.com/integration/contact',
      brandWebsiteUrl: 'https://brand.example.com/integration',
      instagramUrl: 'https://instagram.com/integration',
      contactMemo: 'フォームあり',
      brandAnalysisMemo: '食卓で楽しめる点が強み'
    },
    raw: { ok: true }
  };
}

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
