import { PrismaClient } from '@prisma/client';
import { PrismaReplyInboxRepository } from '../infrastructure/prisma-reply-inbox.repository';
import { RecordMailReplyUseCase } from './record-mail-reply.usecase';

const testDatabaseUrl = requireTestDatabaseUrl();

describe('RecordMailReplyUseCase integration', () => {
  let prisma: PrismaClient;
  let useCase: RecordMailReplyUseCase;
  let replies: PrismaReplyInboxRepository;
  let companyId: string;
  let projectId: string;
  let leadId: string;
  let contactId: string;
  let meetingMailId: string;
  let unsubscribeMailId: string;
  const receivedAt = new Date('2026-07-10T03:00:00.000Z');

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await prisma.$connect();
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const platform = await prisma.crowdfundingPlatform.upsert({
      where: { type_baseUrl: { type: 'campfire', baseUrl: 'https://camp-fire.jp' } },
      update: { isActive: true },
      create: { type: 'campfire', name: 'CAMPFIRE', baseUrl: 'https://camp-fire.jp' }
    });
    const company = await prisma.company.create({ data: { name: `返信フローテスト ${suffix}` } });
    const project = await prisma.crowdfundingProject.create({
      data: {
        platformId: platform.id,
        companyId: company.id,
        title: '返信フロー確認案件',
        url: `https://camp-fire.jp/projects/reply-flow-${suffix}/view`
      }
    });
    const lead = await prisma.salesLead.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        status: 'contacted',
        nextFollowUpAt: new Date('2026-07-20T03:00:00.000Z')
      }
    });
    const contact = await prisma.contactPerson.create({
      data: { companyId: company.id, name: '返信担当', email: 'reply-flow@example.com', isPrimary: true }
    });
    const [meetingMail, unsubscribeMail] = await Promise.all([
      prisma.outreachEmail.create({
        data: { companyId: company.id, leadId: lead.id, contactId: contact.id, status: 'sent', subject: '商談確認', body: '本文' }
      }),
      prisma.outreachEmail.create({
        data: { companyId: company.id, leadId: lead.id, contactId: contact.id, status: 'sent', subject: '停止確認', body: '本文' }
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
    if (companyId) {
      await prisma.emailEvent.deleteMany({ where: { email: { companyId } } });
      await prisma.emailReply.deleteMany({ where: { email: { companyId } } });
      await prisma.task.deleteMany({ where: { leadId } });
      await prisma.outreachEmail.deleteMany({ where: { companyId } });
      await prisma.contactPerson.deleteMany({ where: { companyId } });
      await prisma.salesLead.deleteMany({ where: { companyId } });
      await prisma.crowdfundingProject.delete({ where: { id: projectId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
    await prisma.$disconnect();
  });

  it('keeps the reply, lead next action, task, and reply inbox consistent', async () => {
    const result = await useCase.execute(meetingMailId, {
      fromEmail: 'reply-flow@example.com',
      body: 'ぜひZoomで打ち合わせをしたいです。候補日をください。',
      receivedAt: receivedAt.toISOString()
    });

    const [lead, task, inbox] = await Promise.all([
      prisma.salesLead.findUniqueOrThrow({ where: { id: leadId } }),
      prisma.task.findFirstOrThrow({ where: { leadId, title: '商談日程を調整' } }),
      replies.list({ category: 'meeting_request' })
    ]);

    expect(result.classification.category).toBe('meeting_request');
    expect(lead).toMatchObject({ status: 'meeting_candidate', nextActionAt: receivedAt });
    expect(task).toMatchObject({ status: 'todo', dueAt: receivedAt });
    expect(inbox.items.find((item) => item.id === result.reply.id)).toMatchObject({
      category: 'meeting_request',
      email: { lead: { id: leadId, nextActionAt: receivedAt } }
    });

    await expect(useCase.execute(meetingMailId, {
      fromEmail: 'reply-flow@example.com',
      body: 'ぜひZoomで打ち合わせをしたいです。候補日をください。',
      receivedAt: receivedAt.toISOString()
    })).rejects.toThrow('同じ返信はすでに記録されています。');
    await expect(prisma.task.count({ where: { leadId, title: '商談日程を調整' } })).resolves.toBe(1);
  });

  it('persists unsubscribe and clears follow-up without creating another task', async () => {
    const tasksBefore = await prisma.task.count({ where: { leadId } });

    await useCase.execute(unsubscribeMailId, {
      fromEmail: 'reply-flow@example.com',
      body: '今後のメール配信を停止してください。',
      receivedAt: receivedAt.toISOString()
    });

    const [lead, contact, tasksAfter] = await Promise.all([
      prisma.salesLead.findUniqueOrThrow({ where: { id: leadId } }),
      prisma.contactPerson.findUniqueOrThrow({ where: { id: contactId } }),
      prisma.task.count({ where: { leadId } })
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
