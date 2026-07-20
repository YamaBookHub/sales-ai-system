import { PrismaClient } from '@prisma/client';
import { AuditActor } from '../../audit/audit-actor';
import { PrismaReplyInboxRepository } from '../infrastructure/prisma-reply-inbox.repository';
import { RecordMailReplyUseCase } from './record-mail-reply.usecase';

const testDatabaseUrl = requireTestDatabaseUrl();

describe('RecordMailReplyUseCase integration', () => {
  let prisma: PrismaClient;
  let useCase: RecordMailReplyUseCase;
  let replies: PrismaReplyInboxRepository;
  let organizationId: string;
  let userId: string;
  let sessionId: string;
  let companyId: string;
  let projectId: string;
  let leadId: string;
  let contactId: string;
  let meetingMailId: string;
  let unsubscribeMailId: string;
  let actor: AuditActor;
  const receivedAt = new Date('2026-07-10T03:00:00.000Z');

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await prisma.$connect();
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const organization = await prisma.organization.create({
      data: { slug: `reply-flow-${suffix}`, name: 'Reply flow integration organization' }
    });
    organizationId = organization.id;
    const user = await prisma.user.create({
      data: { email: `reply-flow-${suffix}@example.com`, name: 'Reply flow tester' }
    });
    userId = user.id;
    await prisma.organizationMembership.create({
      data: { organizationId, userId, role: 'admin' }
    });
    const session = await prisma.userSession.create({
      data: {
        organizationId,
        userId,
        tokenHash: `reply-flow-token-${suffix}`,
        csrfTokenHash: `reply-flow-csrf-${suffix}`,
        absoluteExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
        idleExpiresAt: new Date('2030-01-01T00:00:00.000Z')
      }
    });
    sessionId = session.id;
    actor = { organizationId, userId, sessionId };
    const platform = await prisma.crowdfundingPlatform.upsert({
      where: { type_baseUrl: { type: 'campfire', baseUrl: 'https://camp-fire.jp' } },
      update: { isActive: true },
      create: { type: 'campfire', name: 'CAMPFIRE', baseUrl: 'https://camp-fire.jp' }
    });
    const company = await prisma.company.create({
      data: { organizationId, name: `返信フローテスト ${suffix}` }
    });
    const project = await prisma.crowdfundingProject.create({
      data: {
        organizationId,
        platformId: platform.id,
        companyId: company.id,
        title: '返信フロー確認案件',
        url: `https://camp-fire.jp/projects/reply-flow-${suffix}/view`
      }
    });
    const lead = await prisma.salesLead.create({
      data: {
        organizationId,
        companyId: company.id,
        projectId: project.id,
        status: 'contacted',
        nextFollowUpAt: new Date('2026-07-20T03:00:00.000Z')
      }
    });
    const contact = await prisma.contactPerson.create({
      data: {
        organizationId,
        companyId: company.id,
        name: '返信担当',
        email: 'reply-flow@example.com',
        isPrimary: true
      }
    });
    const [meetingMail, unsubscribeMail] = await Promise.all([
      prisma.outreachEmail.create({
        data: {
          organizationId,
          companyId: company.id,
          leadId: lead.id,
          contactId: contact.id,
          status: 'sent',
          subject: '商談確認',
          body: '本文'
        }
      }),
      prisma.outreachEmail.create({
        data: {
          organizationId,
          companyId: company.id,
          leadId: lead.id,
          contactId: contact.id,
          status: 'sent',
          subject: '停止確認',
          body: '本文'
        }
      })
    ]);

    companyId = company.id;
    projectId = project.id;
    leadId = lead.id;
    contactId = contact.id;
    meetingMailId = meetingMail.id;
    unsubscribeMailId = unsubscribeMail.id;
    useCase = new RecordMailReplyUseCase(prisma as any);
    replies = new PrismaReplyInboxRepository(prisma as any);
  });

  afterAll(async () => {
    try {
      if (organizationId) {
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

  it('keeps the reply, lead next action, task, and reply inbox consistent', async () => {
    const result = await useCase.execute(meetingMailId, {
      fromEmail: 'reply-flow@example.com',
      body: 'ぜひZoomで打ち合わせをしたいです。候補日をください。',
      receivedAt: receivedAt.toISOString()
    }, actor);

    const [lead, task, inbox, opportunity] = await Promise.all([
      prisma.salesLead.findFirstOrThrow({ where: { organizationId, id: leadId } }),
      prisma.task.findFirstOrThrow({ where: { organizationId, leadId, title: '商談日程を調整' } }),
      replies.list(organizationId, { category: 'meeting_request' }),
      prisma.opportunity.findFirstOrThrow({ where: { organizationId, leadId } })
    ]);

    expect(result.classification.category).toBe('meeting_request');
    expect(lead).toMatchObject({ status: 'meeting_candidate', nextActionAt: receivedAt });
    expect(task).toMatchObject({ status: 'todo', dueAt: receivedAt });
    expect(opportunity).toMatchObject({ stage: 'meeting', probability: 50 });
    expect(inbox.items.find((item) => item.id === result.reply.id)).toMatchObject({
      category: 'meeting_request',
      email: { lead: { id: leadId, nextActionAt: receivedAt } }
    });

    await expect(useCase.execute(meetingMailId, {
      fromEmail: 'reply-flow@example.com',
      body: 'ぜひZoomで打ち合わせをしたいです。候補日をください。',
      receivedAt: receivedAt.toISOString()
    }, actor)).rejects.toThrow('同じ返信はすでに記録されています。');
    await expect(prisma.task.count({ where: { organizationId, leadId, title: '商談日程を調整' } })).resolves.toBe(1);
  });

  it('persists unsubscribe and clears follow-up without creating another task', async () => {
    const tasksBefore = await prisma.task.count({ where: { organizationId, leadId } });

    await useCase.execute(unsubscribeMailId, {
      fromEmail: 'reply-flow@example.com',
      body: '今後のメール配信を停止してください。',
      receivedAt: receivedAt.toISOString()
    }, actor);

    const [lead, contact, tasksAfter] = await Promise.all([
      prisma.salesLead.findFirstOrThrow({ where: { organizationId, id: leadId } }),
      prisma.contactPerson.findFirstOrThrow({ where: { organizationId, id: contactId } }),
      prisma.task.count({ where: { organizationId, leadId } })
    ]);
    expect(lead).toMatchObject({ status: 'rejected', nextActionAt: null, nextFollowUpAt: null });
    expect(contact).toMatchObject({ isUnsubscribed: true, isPrimary: false, unsubscribedAt: receivedAt });
    expect(tasksAfter).toBe(tasksBefore);
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
