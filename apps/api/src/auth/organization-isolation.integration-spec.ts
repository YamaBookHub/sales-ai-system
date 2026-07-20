import { PrismaClient } from '@prisma/client';
import { CompaniesService } from '../companies/companies.service';

const testDatabaseUrl = requireTestDatabaseUrl();

describe('Organization isolation integration', () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const sharedProjectUrl = `https://example.test/projects/organization-isolation-${suffix}`;
  const sharedTemplateKey = `organization-isolation-${suffix}`;
  const platformBaseUrl = `https://example.test/platforms/${suffix}`;
  let prisma: PrismaClient;
  let companies: CompaniesService;
  let organizationAId: string;
  let organizationBId: string;
  let companyAId: string;
  let companyBId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await prisma.$connect();
    companies = new CompaniesService(prisma as any);

    const [organizationA, organizationB] = await Promise.all([
      prisma.organization.create({
        data: { slug: `isolation-a-${suffix}`, name: 'Organization isolation A' }
      }),
      prisma.organization.create({
        data: { slug: `isolation-b-${suffix}`, name: 'Organization isolation B' }
      })
    ]);
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;
  });

  afterAll(async () => {
    if (!prisma) return;

    try {
      const organizationIds = [organizationAId, organizationBId].filter(Boolean);
      if (organizationIds.length > 0) {
        await prisma.mailTemplate.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await prisma.crowdfundingProject.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await prisma.company.deleteMany({ where: { organizationId: { in: organizationIds } } });
        await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
      }
      await prisma.crowdfundingPlatform.deleteMany({ where: { baseUrl: platformBaseUrl } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('allows the same project URL and mail template key in separate organizations', async () => {
    const platform = await prisma.crowdfundingPlatform.create({
      data: {
        type: 'other',
        name: `Organization isolation platform ${suffix}`,
        baseUrl: platformBaseUrl
      }
    });
    const [companyA, companyB] = await Promise.all([
      prisma.company.create({
        data: { organizationId: organizationAId, name: `Organization A company ${suffix}` }
      }),
      prisma.company.create({
        data: { organizationId: organizationBId, name: `Organization B company ${suffix}` }
      })
    ]);
    companyAId = companyA.id;
    companyBId = companyB.id;

    const [projectA, projectB, templateA, templateB] = await Promise.all([
      prisma.crowdfundingProject.create({
        data: {
          organizationId: organizationAId,
          platformId: platform.id,
          companyId: companyA.id,
          title: 'Shared URL project A',
          url: sharedProjectUrl,
          status: 'active'
        }
      }),
      prisma.crowdfundingProject.create({
        data: {
          organizationId: organizationBId,
          platformId: platform.id,
          companyId: companyB.id,
          title: 'Shared URL project B',
          url: sharedProjectUrl,
          status: 'active'
        }
      }),
      prisma.mailTemplate.create({
        data: {
          organizationId: organizationAId,
          key: sharedTemplateKey,
          name: 'Organization A template',
          body: 'Organization A body'
        }
      }),
      prisma.mailTemplate.create({
        data: {
          organizationId: organizationBId,
          key: sharedTemplateKey,
          name: 'Organization B template',
          body: 'Organization B body'
        }
      })
    ]);

    expect(projectA.id).not.toBe(projectB.id);
    expect(templateA.id).not.toBe(templateB.id);
    await expect(prisma.crowdfundingProject.count({ where: { url: sharedProjectUrl } })).resolves.toBe(2);
    await expect(prisma.mailTemplate.count({ where: { key: sharedTemplateKey } })).resolves.toBe(2);
  });

  it('rejects a child record that combines an organization with another organization parent id', async () => {
    await expect(
      prisma.contactPerson.create({
        data: {
          organizationId: organizationAId,
          companyId: companyBId,
          name: 'Cross organization contact'
        }
      })
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rejects duplicate business keys inside the same organization', async () => {
    const platform = await prisma.crowdfundingPlatform.findUniqueOrThrow({
      where: { type_baseUrl: { type: 'other', baseUrl: platformBaseUrl } }
    });

    await expect(prisma.crowdfundingProject.create({
      data: {
        organizationId: organizationAId,
        platformId: platform.id,
        companyId: companyAId,
        title: 'Duplicate URL in organization A',
        url: sharedProjectUrl,
        status: 'active'
      }
    })).rejects.toMatchObject({ code: 'P2002' });

    await expect(prisma.mailTemplate.create({
      data: {
        organizationId: organizationAId,
        key: sharedTemplateKey,
        name: 'Duplicate template in organization A',
        body: 'Duplicate body'
      }
    })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('returns only the active organization companies from the scoped service query', async () => {
    const result = await companies.list(organizationAId, 1, 20);

    expect(result.items.map((company) => company.id)).toContain(companyAId);
    expect(result.items.map((company) => company.id)).not.toContain(companyBId);
    expect(result.total).toBe(1);
  });

  it('hides another organization company from a scoped write', async () => {
    await expect(companies.block(companyBId, { blockedReason: 'must not cross organizations' }, {
      organizationId: organizationAId,
      userId: '00000000-0000-4000-8000-000000000001',
      sessionId: '00000000-0000-4000-8000-000000000002'
    })).rejects.toMatchObject({ code: 'P2025' });
  });
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
