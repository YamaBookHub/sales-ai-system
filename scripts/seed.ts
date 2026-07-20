import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const organizationId = '00000000-0000-4000-8000-000000000007';

async function main() {
  await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.upsert({
      where: { slug: 'default' },
      update: { isActive: true },
      create: {
        id: organizationId,
        slug: 'default',
        name: '既定組織'
      }
    });

    const admin = await tx.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        name: 'Admin User'
      }
    });

    const membership = await tx.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: admin.id
        }
      },
      update: { displayName: admin.name, role: 'admin', isActive: true },
      create: {
        organizationId: organization.id,
        userId: admin.id,
        displayName: admin.name,
        role: 'admin'
      }
    });

    const platform = await tx.crowdfundingPlatform.upsert({
      where: {
        type_baseUrl: {
          type: 'campfire',
          baseUrl: 'https://camp-fire.jp'
        }
      },
      update: {},
      create: {
        type: 'campfire',
        name: 'CAMPFIRE',
        baseUrl: 'https://camp-fire.jp'
      }
    });

    const company = (await tx.company.findFirst({
      where: {
        organizationId: organization.id,
        normalizedName: 'サンプル株式会社',
        deletedAt: null
      }
    })) ?? await tx.company.create({
      data: {
        organizationId: organization.id,
        name: 'サンプル株式会社',
        normalizedName: 'サンプル株式会社',
        websiteUrl: 'https://example.com',
        industry: 'クラウドファンディング'
      }
    });

    const project = await tx.crowdfundingProject.upsert({
      where: {
        organizationId_url: {
          organizationId: organization.id,
          url: 'https://camp-fire.jp/projects/sample/view'
        }
      },
      update: {
        companyId: company.id,
        status: 'active',
        amount: 3500000,
        supporterCount: 250
      },
      create: {
        organizationId: organization.id,
        platformId: platform.id,
        companyId: company.id,
        title: 'サンプルCAMPFIREプロジェクト',
        url: 'https://camp-fire.jp/projects/sample/view',
        status: 'active',
        amount: 3500000,
        supporterCount: 250,
        category: 'プロダクト'
      }
    });

    const lead = await tx.salesLead.upsert({
      where: {
        organizationId_companyId_projectId: {
          organizationId: organization.id,
          companyId: company.id,
          projectId: project.id
        }
      },
      update: { ownerMemo: 'API疎通確認用の初期リード' },
      create: {
        organizationId: organization.id,
        companyId: company.id,
        projectId: project.id,
        status: 'qualified',
        priority: 'medium',
        source: 'seed',
        ownerMemo: 'API疎通確認用の初期リード'
      }
    });

    await tx.auditLog.create({
      data: {
        organizationId: organization.id,
        userId: membership.userId,
        action: 'seed',
        entityType: 'System',
        entityId: lead.id,
        after: {
          companyId: company.id,
          projectId: project.id,
          leadId: lead.id
        }
      }
    });

    console.log({
      admin: admin.email,
      platform: platform.name,
      company: company.name,
      project: project.title,
      leadId: lead.id
    });
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
