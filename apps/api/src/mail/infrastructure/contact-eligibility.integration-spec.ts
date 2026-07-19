import { PrismaClient } from '@prisma/client';
import { GenerateMailDraftUseCase } from '../../ai/application/generate-mail-draft.usecase';
import { projectSourceFingerprint } from '../../ai/domain/lead-analysis';
import { MarkMailSentUseCase } from '../application/mark-mail-sent.usecase';
import { PrismaMailWorkflowRepository } from './prisma-mail-workflow.repository';

const testDatabaseUrl = requireTestDatabaseUrl();

describe('contact eligibility integration', () => {
  let prisma: PrismaClient;
  const companyIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    if (companyIds.length > 0) {
      await prisma.emailEvent.deleteMany({ where: { email: { companyId: { in: companyIds } } } });
      await prisma.aiGeneration.deleteMany({ where: { lead: { companyId: { in: companyIds } } } });
      await prisma.outreachEmail.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.contactPerson.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.salesLead.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.crowdfundingProject.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    }
    await prisma.$disconnect();
  });

  it('keeps mail, AI history, and lead state unchanged for a blocked company', async () => {
    const fixture = await createFixture('blocked');
    await prisma.company.update({ where: { id: fixture.companyId }, data: { isBlocked: true } });
    const useCase = new GenerateMailDraftUseCase(prisma as any);

    await expect(useCase.execute(fixture.leadIds[0], {
      templateKey: 'normal',
      analysisRevisionId: fixture.analysisRevisionIds[0]
    }))
      .rejects.toThrow('この企業は送信禁止');

    expect(await prisma.outreachEmail.count({ where: { leadId: fixture.leadIds[0] } })).toBe(0);
    expect(await prisma.aiGeneration.count({ where: { leadId: fixture.leadIds[0] } })).toBe(0);
    expect((await prisma.salesLead.findUniqueOrThrow({ where: { id: fixture.leadIds[0] } })).status)
      .toBe('qualified');
  });

  it('allows only one active draft for the same normalized recipient across leads', async () => {
    const fixture = await createFixture('duplicate');
    const useCase = new GenerateMailDraftUseCase(prisma as any);

    await useCase.execute(fixture.leadIds[0], {
      templateKey: 'normal',
      analysisRevisionId: fixture.analysisRevisionIds[0]
    });
    await expect(useCase.execute(fixture.leadIds[1], {
      templateKey: 'normal',
      analysisRevisionId: fixture.analysisRevisionIds[1]
    }))
      .rejects.toThrow('重複接触');

    expect(await prisma.outreachEmail.count({ where: { companyId: fixture.companyId } })).toBe(1);
    expect((await prisma.salesLead.findUniqueOrThrow({ where: { id: fixture.leadIds[1] } })).status)
      .toBe('qualified');
  });

  it('does not advance review after the selected contact unsubscribes', async () => {
    const fixture = await createFixture('unsubscribe');
    const generated = await new GenerateMailDraftUseCase(prisma as any)
      .execute(fixture.leadIds[0], {
        templateKey: 'normal',
        analysisRevisionId: fixture.analysisRevisionIds[0]
      });
    await prisma.contactPerson.update({
      where: { id: fixture.contactId },
      data: { isUnsubscribed: true, unsubscribedAt: new Date(), isPrimary: false }
    });
    const repository = new PrismaMailWorkflowRepository(prisma as any);

    await expect(repository.transitionIfDeliveryAllowed(
      generated.email.id,
      'in_review',
      'reviewed'
    )).rejects.toThrow('配信停止');

    expect((await prisma.outreachEmail.findUniqueOrThrow({ where: { id: generated.email.id } })).status)
      .toBe('draft');
    expect((await prisma.salesLead.findUniqueOrThrow({ where: { id: fixture.leadIds[0] } })).status)
      .toBe('drafted');
  });

  it('records one sent event when the same manual sent action runs concurrently', async () => {
    const fixture = await createFixture('manual-sent');
    const generated = await new GenerateMailDraftUseCase(prisma as any)
      .execute(fixture.leadIds[0], {
        templateKey: 'normal',
        analysisRevisionId: fixture.analysisRevisionIds[0]
      });
    await prisma.outreachEmail.update({
      where: { id: generated.email.id },
      data: { status: 'approved' }
    });
    const useCase = new MarkMailSentUseCase(new PrismaMailWorkflowRepository(prisma as any));

    const results = await Promise.allSettled([
      useCase.execute(generated.email.id, {}),
      useCase.execute(generated.email.id, {})
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await prisma.outreachEmail.findUniqueOrThrow({ where: { id: generated.email.id } })).status)
      .toBe('sent');
    expect(await prisma.emailEvent.count({
      where: { emailId: generated.email.id, type: 'sent' }
    })).toBe(1);
    expect(await prisma.opportunity.findUnique({ where: { leadId: fixture.leadIds[0] } }))
      .toMatchObject({ stage: 'contacted', probability: 10, version: 2 });
    expect(await prisma.opportunityStageHistory.count({
      where: { opportunity: { leadId: fixture.leadIds[0] }, operationKey: `mail-sent:${generated.email.id}` }
    })).toBe(1);
  });

  async function createFixture(label: string) {
    const suffix = `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const platform = await prisma.crowdfundingPlatform.upsert({
      where: { type_baseUrl: { type: 'campfire', baseUrl: 'https://camp-fire.jp' } },
      update: { isActive: true },
      create: { type: 'campfire', name: 'CAMPFIRE', baseUrl: 'https://camp-fire.jp' }
    });
    const company = await prisma.company.create({
      data: { name: `配信判定テスト ${suffix}`, inquiryUrl: `https://example.com/${suffix}/contact` }
    });
    companyIds.push(company.id);
    const contact = await prisma.contactPerson.create({
      data: {
        companyId: company.id,
        name: '営業担当',
        email: `sales-${suffix}@example.com`,
        isPrimary: true
      }
    });
    const projects = await Promise.all([0, 1].map((index) => prisma.crowdfundingProject.create({
      data: {
        platformId: platform.id,
        companyId: company.id,
        title: `配信判定案件 ${index + 1}`,
        url: `https://camp-fire.jp/projects/${suffix}-${index}/view`,
        status: 'active',
        description: '商品の魅力を確認するためのテスト案件です。'
      }
    })));
    const leads = await Promise.all(projects.map((project) => prisma.salesLead.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        status: 'qualified',
        sendMethod: 'email'
      }
    })));
    const analysisRevisions = await Promise.all(leads.map((lead, index) => prisma.leadAnalysisRevision.create({
      data: {
        leadId: lead.id,
        projectId: projects[index].id,
        version: 1,
        status: 'confirmed',
        origin: 'manual',
        appeal: '商品の特徴が分かりやすく伝わる点',
        targetUser: '商品の利用場面を具体的に考えたい方',
        videoIdea: '利用前後を短尺動画で比較する見せ方',
        sourceFingerprint: projectSourceFingerprint(projects[index]),
        confirmedAt: new Date(),
        humanEdited: true,
        editedFields: ['appeal', 'targetUser', 'videoIdea']
      }
    })));

    return {
      companyId: company.id,
      contactId: contact.id,
      leadIds: leads.map((lead) => lead.id),
      analysisRevisionIds: analysisRevisions.map((revision) => revision.id)
    };
  }
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
