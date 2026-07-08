import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin'
    }
  });

  const platform = await prisma.crowdfundingPlatform.upsert({
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

  const company = await prisma.company.create({
    data: {
      name: 'サンプル株式会社',
      normalizedName: 'サンプル株式会社',
      websiteUrl: 'https://example.com',
      industry: 'クラウドファンディング'
    }
  });

  const project = await prisma.crowdfundingProject.create({
    data: {
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

  const lead = await prisma.salesLead.create({
    data: {
      companyId: company.id,
      projectId: project.id,
      status: 'qualified',
      priority: 'medium',
      source: 'seed',
      ownerMemo: 'API疎通確認用の初期リード'
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
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
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
