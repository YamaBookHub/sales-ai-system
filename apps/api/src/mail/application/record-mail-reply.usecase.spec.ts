import { NotFoundException } from '@nestjs/common';
import { RecordMailReplyUseCase } from './record-mail-reply.usecase';

describe('RecordMailReplyUseCase', () => {
  const receivedAt = '2026-07-11T03:00:00.000Z';

  function createSubject(email: { id: string; companyId: string; contactId: string | null; leadId: string | null } | null = {
    id: 'mail_1', companyId: 'company_1', contactId: 'contact_1', leadId: 'lead_1'
  }) {
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      outreachEmail: { findUnique: jest.fn().mockResolvedValue(email) },
      emailReply: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'reply_1' })
      },
      emailEvent: { create: jest.fn().mockResolvedValue({ id: 'event_1' }) },
      contactPerson: {
        update: jest.fn().mockResolvedValue({ id: 'contact_1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      salesLead: { update: jest.fn().mockResolvedValue({ id: 'lead_1' }) },
      task: { create: jest.fn().mockResolvedValue({ id: 'task_1' }) }
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    return { useCase: new RecordMailReplyUseCase(prisma as any), prisma, tx };
  }

  it('records a meeting reply and creates the matching lead task in one transaction', async () => {
    const { useCase, prisma, tx } = createSubject();

    const result = await useCase.execute('mail_1', {
      fromEmail: 'contact@example.com',
      body: 'ぜひZoomで打ち合わせしたいです。候補日をください。',
      receivedAt
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      expect.stringContaining('mail-reply:mail_1:contact@example.com:')
    );
    expect(tx.emailReply.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        emailId: 'mail_1',
        category: 'meeting_request',
        receivedAt: new Date(receivedAt)
      })
    });
    expect(tx.salesLead.update).toHaveBeenCalledWith({
      where: { id: 'lead_1' },
      data: {
        status: 'meeting_candidate',
        nextActionAt: new Date(receivedAt)
      }
    });
    expect(tx.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: 'lead_1',
        title: '商談日程を調整',
        dueAt: new Date(receivedAt)
      })
    });
    expect(tx.emailEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        emailId: 'mail_1',
        type: 'replied',
        payload: expect.objectContaining({ category: 'meeting_request', taskId: 'task_1' })
      })
    });
    expect(result).toMatchObject({
      reply: { id: 'reply_1' },
      classification: { category: 'meeting_request' },
      task: { id: 'task_1' }
    });
  });

  it('persists unsubscribe, clears follow-up dates, and does not create a task', async () => {
    const { useCase, tx } = createSubject();

    const result = await useCase.execute('mail_1', {
      fromEmail: 'contact@example.com',
      body: '今後のメール配信を停止してください。',
      receivedAt
    });

    expect(tx.contactPerson.update).toHaveBeenCalledWith({
      where: { id: 'contact_1' },
      data: { isUnsubscribed: true, unsubscribedAt: new Date(receivedAt), isPrimary: false }
    });
    expect(tx.salesLead.update).toHaveBeenCalledWith({
      where: { id: 'lead_1' },
      data: {
        status: 'rejected',
        nextActionAt: null,
        nextFollowUpAt: null
      }
    });
    expect(tx.task.create).not.toHaveBeenCalled();
    expect(result.task).toBeNull();
  });

  it('matches the unsubscribe sender within the company when the mail has no contact', async () => {
    const { useCase, tx } = createSubject({ id: 'mail_1', companyId: 'company_1', contactId: null, leadId: 'lead_1' });

    await useCase.execute('mail_1', {
      fromEmail: 'CONTACT@EXAMPLE.COM',
      body: '今後の連絡は不要です。メールを停止してください。',
      receivedAt
    });

    expect(tx.contactPerson.updateMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company_1',
        email: { equals: 'CONTACT@EXAMPLE.COM', mode: 'insensitive' },
        deletedAt: null
      },
      data: { isUnsubscribed: true, unsubscribedAt: new Date(receivedAt), isPrimary: false }
    });
  });

  it('rejects an unknown mail before writing reply data', async () => {
    const { useCase, tx } = createSubject(null);

    await expect(useCase.execute('missing', { body: '確認しました。' })).rejects.toThrow(NotFoundException);
    expect(tx.emailReply.create).not.toHaveBeenCalled();
  });

  it('rejects an immediate duplicate before creating another task', async () => {
    const { useCase, tx } = createSubject();
    tx.emailReply.findFirst.mockResolvedValue({ id: 'reply_existing' });

    await expect(useCase.execute('mail_1', {
      fromEmail: 'contact@example.com',
      body: '確認しました。'
    })).rejects.toThrow('同じ返信はすでに記録されています。');

    expect(tx.emailReply.create).not.toHaveBeenCalled();
    expect(tx.task.create).not.toHaveBeenCalled();
  });
});
