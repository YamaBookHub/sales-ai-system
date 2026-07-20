import { PrismaClient } from '@prisma/client';
import { AuditActor } from '../../audit/audit-actor';
import { GenerateMailDraftUseCase } from '../../ai/application/generate-mail-draft.usecase';
import { projectSourceFingerprint } from '../../ai/domain/lead-analysis';
import { MarkMailSentUseCase } from '../application/mark-mail-sent.usecase';
import { PrismaMailWorkflowRepository } from './prisma-mail-workflow.repository';

const testDatabaseUrl = requireTestDatabaseUrl();

describe('contact eligibility integration', () => {
  let prisma: PrismaClient;
  const companyIds: string[] = [];
  let organizationId: string;
  let userId: string;
  let actor: AuditActor;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await prisma.$connect();
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const organization = await prisma.organization.create({
      data: { slug: `contact-eligibility-${suffix}`, name: 'Contact eligibility integration organization' }
    });
    organizationId = organization.id;
    const user = await prisma.user.create({
      data: { email: `contact-eligibility-${suffix}@example.com`, name: 'Contact eligibility tester' }
    });
    userId = user.id;
    await prisma.organizationMembership.create({
      data: { organizationId, userId, role: 'admin' }
    });
    const session = await prisma.userSession.create({
      data: {
        organizationId,
        userId,
        tokenHash: `contact-eligibility-token-${suffix}`,
        csrfTokenHash: `contact-eligibility-csrf-${suffix}`,
        absoluteExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
        idleExpiresAt: new Date('2030-01-01T00:00:00.000Z')
      }
    });
    actor = { organizationId, userId, sessionId: session.id };
  });

  afterAll(async () => {
    try {
      if (organizationId) {
        await prisma.linkClick.deleteMany({ where: { organizationId } });
        await prisma.trackedLink.deleteMany({ where: { organizationId } });
        await prisma.mailAttachment.deleteMany({ where: { organizationId } });
        await prisma.emailEvent.deleteMany({ where: { organizationId } });
        await prisma.emailReply.deleteMany({ where: { organizationId } });
        await prisma.mailChecklistItem.deleteMany({ where: { organizationId } });
        await prisma.aiGeneration.deleteMany({ where: { organizationId } });
        await prisma.outreachEmail.deleteMany({ where: { organizationId } });
        await prisma.opportunityStageHistory.deleteMany({ where: { organizationId } });
        await prisma.opportunity.deleteMany({ where: { organizationId } });
        await prisma.task.deleteMany({ where: { organizationId } });
        await prisma.leadAnalysisRevision.deleteMany({ where: { organizationId } });
        await prisma.leadScore.deleteMany({ where: { organizationId } });
        await prisma.contactPerson.deleteMany({ where: { organizationId } });
        await prisma.salesLead.deleteMany({ where: { organizationId } });
        await prisma.crowdfundingProject.deleteMany({ where: { organizationId } });
        await prisma.company.deleteMany({ where: { organizationId } });
        await prisma.auditLog.deleteMany({ where: { organizationId } });
        await prisma.userSession.deleteMany({ where: { organizationId } });
        await prisma.organizationMembership.deleteMany({ where: { organizationId } });
        await prisma.user.deleteMany({ where: { id: userId } });
        await prisma.organization.deleteMany({ where: { id: organizationId } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it('keeps mail, AI history, and lead state unchanged for a blocked company', async () => {
    const fixture = await createFixture('blocked');
    await prisma.company.update({
      where: { organizationId_id: { organizationId, id: fixture.companyId } },
      data: { isBlocked: true }
    });
    const useCase = new GenerateMailDraftUseCase(prisma as any);

    await expect(useCase.execute(fixture.leadIds[0], {
      templateKey: 'normal',
      analysisRevisionId: fixture.analysisRevisionIds[0]
    }, actor))
      .rejects.toThrow('この企業は送信禁止');

    expect(await prisma.outreachEmail.count({ where: { organizationId, leadId: fixture.leadIds[0] } })).toBe(0);
    expect(await prisma.aiGeneration.count({ where: { organizationId, leadId: fixture.leadIds[0] } })).toBe(0);
    expect((await prisma.salesLead.findFirstOrThrow({ where: { organizationId, id: fixture.leadIds[0] } })).status)
      .toBe('qualified');
  });

  it('allows only one active draft for the same normalized recipient across leads', async () => {
    const fixture = await createFixture('duplicate');
    const useCase = new GenerateMailDraftUseCase(prisma as any);

    await useCase.execute(fixture.leadIds[0], {
      templateKey: 'normal',
      analysisRevisionId: fixture.analysisRevisionIds[0]
    }, actor);
    await expect(useCase.execute(fixture.leadIds[1], {
      templateKey: 'normal',
      analysisRevisionId: fixture.analysisRevisionIds[1]
    }, actor))
      .rejects.toThrow('重複接触');

    expect(await prisma.outreachEmail.count({ where: { organizationId, companyId: fixture.companyId } })).toBe(1);
    expect((await prisma.salesLead.findFirstOrThrow({ where: { organizationId, id: fixture.leadIds[1] } })).status)
      .toBe('qualified');
  });

  it('does not advance review after the selected contact unsubscribes', async () => {
    const fixture = await createFixture('unsubscribe');
    const generated = await new GenerateMailDraftUseCase(prisma as any)
      .execute(fixture.leadIds[0], {
        templateKey: 'normal',
        analysisRevisionId: fixture.analysisRevisionIds[0]
      }, actor);
    await prisma.contactPerson.update({
      where: { organizationId_id: { organizationId, id: fixture.contactId } },
      data: { isUnsubscribed: true, unsubscribedAt: new Date(), isPrimary: false }
    });
    const repository = new PrismaMailWorkflowRepository(prisma as any);

    await expect(repository.transitionIfDeliveryAllowed(
      generated.email.id,
      'in_review',
      'reviewed',
      {},
      undefined,
      actor
    )).rejects.toThrow('配信停止');

    expect((await prisma.outreachEmail.findFirstOrThrow({ where: { organizationId, id: generated.email.id } })).status)
      .toBe('draft');
    expect((await prisma.salesLead.findFirstOrThrow({ where: { organizationId, id: fixture.leadIds[0] } })).status)
      .toBe('drafted');
  });

  it('records one sent event when the same manual sent action runs concurrently', async () => {
    const fixture = await createFixture('manual-sent');
    const generated = await new GenerateMailDraftUseCase(prisma as any)
      .execute(fixture.leadIds[0], {
        templateKey: 'normal',
        analysisRevisionId: fixture.analysisRevisionIds[0]
      }, actor);
    await prisma.outreachEmail.update({
      where: { organizationId_id: { organizationId, id: generated.email.id } },
      data: { status: 'approved' }
    });
    const useCase = new MarkMailSentUseCase(new PrismaMailWorkflowRepository(prisma as any));

    const results = await Promise.allSettled([
      useCase.execute(generated.email.id, {}, actor),
      useCase.execute(generated.email.id, {}, actor)
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await prisma.outreachEmail.findFirstOrThrow({ where: { organizationId, id: generated.email.id } })).status)
      .toBe('sent');
    expect(await prisma.emailEvent.count({
      where: { organizationId, emailId: generated.email.id, type: 'sent' }
    })).toBe(1);
    expect(await prisma.opportunity.findFirst({ where: { organizationId, leadId: fixture.leadIds[0] } }))
      .toMatchObject({ stage: 'contacted', probability: 10, version: 2 });
    expect(await prisma.opportunityStageHistory.count({
      where: {
        organizationId,
        opportunity: { is: { organizationId, leadId: fixture.leadIds[0] } },
        operationKey: `mail-sent:${generated.email.id}`
      }
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
      data: {
        organizationId,
        name: `配信判定テスト ${suffix}`,
        inquiryUrl: `https://example.com/${suffix}/contact`
      }
    });
    companyIds.push(company.id);
    const contact = await prisma.contactPerson.create({
      data: {
        organizationId,
        companyId: company.id,
        name: '営業担当',
        email: `sales-${suffix}@example.com`,
        isPrimary: true
      }
    });
    const projects = await Promise.all([0, 1].map((index) => prisma.crowdfundingProject.create({
      data: {
        organizationId,
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
        organizationId,
        companyId: company.id,
        projectId: project.id,
        status: 'qualified',
        sendMethod: 'email'
      }
    })));
    const analysisRevisions = await Promise.all(leads.map((lead, index) => prisma.leadAnalysisRevision.create({
      data: {
        organizationId,
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
