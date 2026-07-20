import { ConflictException, NotFoundException } from '@nestjs/common';
import { RecordMailReplyUseCase } from './record-mail-reply.usecase';

describe('RecordMailReplyUseCase', () => {
  const organizationId = 'org_1';
  const receivedAt = '2026-07-11T03:00:00.000Z';
  const actor = {
    userId: '11111111-1111-4111-8111-111111111111',
    sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    organizationId
  };

  function createSubject(email: {
    id: string;
    organizationId?: string;
    companyId: string;
    contactId: string | null;
    leadId: string | null;
  } | null = {
    id: 'mail_1', organizationId, companyId: 'company_1', contactId: 'contact_1', leadId: 'lead_1'
  }) {
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      outreachEmail: { findFirst: jest.fn().mockResolvedValue(email) },
      emailReply: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'reply_1', organizationId })
      },
      emailEvent: { create: jest.fn().mockResolvedValue({ id: 'event_1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit_1' }) },
      contactPerson: {
        update: jest.fn().mockResolvedValue({ id: 'contact_1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      salesLead: {
        findFirst: jest.fn().mockResolvedValue({ id: 'lead_1', organizationId }),
        update: jest.fn().mockResolvedValue({ id: 'lead_1' })
      },
      task: { create: jest.fn().mockResolvedValue({ id: 'task_1', organizationId }) },
      opportunity: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'opportunity_1', organizationId, leadId: 'lead_1', stage: 'contacted', probability: 10, version: 1
        }),
        update: jest.fn().mockResolvedValue({
          id: 'opportunity_1', organizationId, leadId: 'lead_1', stage: 'meeting', probability: 50, version: 2
        })
      },
      opportunityStageHistory: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'history_1', organizationId })
      }
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
    }, actor);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      expect.stringContaining(`mail-reply:${organizationId}:mail_1:contact@example.com:`)
    );
    expect(tx.outreachEmail.findFirst).toHaveBeenCalledWith({
      where: { id: 'mail_1', organizationId },
      select: expect.any(Object)
    });
    expect(tx.emailReply.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        emailId: 'mail_1',
        category: 'meeting_request',
        receivedAt: new Date(receivedAt)
      })
    });
    expect(tx.salesLead.update).toHaveBeenCalledWith({
      where: { organizationId_id: { organizationId, id: 'lead_1' } },
      data: { status: 'meeting_candidate', nextActionAt: new Date(receivedAt) }
    });
    expect(tx.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        leadId: 'lead_1',
        title: '商談日程を調整',
        dueAt: new Date(receivedAt)
      })
    });
    expect(tx.emailEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        emailId: 'mail_1',
        type: 'replied',
        payload: expect.objectContaining({ category: 'meeting_request', taskId: 'task_1', actorUserId: actor.userId })
      })
    });
    expect(tx.opportunity.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId_id: { organizationId, id: 'opportunity_1' } },
      data: expect.objectContaining({ stage: 'meeting', probability: 50 })
    }));
    expect(tx.opportunityStageHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        opportunityId: 'opportunity_1',
        fromStage: 'contacted',
        toStage: 'meeting',
        sourceId: 'reply_1',
        operationKey: 'mail-reply:reply_1'
      })
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId, action: 'mail.reply_recorded', entityId: 'mail_1' })
    });
    expect(result).toMatchObject({
      reply: { id: 'reply_1' },
      classification: { category: 'meeting_request' },
      task: { id: 'task_1' }
    });
  });

  it('audits a manually recorded reply without storing its sender or body', async () => {
    const { useCase, tx } = createSubject();

    await useCase.execute('mail_1', {
      fromEmail: 'contact@example.com',
      body: 'ぜひZoomで打ち合わせしたいです。候補日をください。',
      receivedAt
    }, actor);

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        userId: actor.userId,
        sessionId: actor.sessionId,
        action: 'mail.reply_recorded',
        entityId: 'mail_1'
      })
    });
    const serialized = JSON.stringify(tx.auditLog.create.mock.calls[0][0]);
    expect(serialized).not.toContain('contact@example.com');
    expect(serialized).not.toContain('ぜひZoomで打ち合わせしたいです。');
  });

  it('persists unsubscribe, clears follow-up dates, and does not create a task', async () => {
    const { useCase, tx } = createSubject();

    const result = await useCase.execute('mail_1', {
      fromEmail: 'contact@example.com',
      body: '今後のメール配信を停止してください。',
      receivedAt
    }, actor);

    expect(tx.contactPerson.update).toHaveBeenCalledWith({
      where: { organizationId_id: { organizationId, id: 'contact_1' } },
      data: { isUnsubscribed: true, unsubscribedAt: new Date(receivedAt), isPrimary: false }
    });
    expect(tx.salesLead.update).toHaveBeenCalledWith({
      where: { organizationId_id: { organizationId, id: 'lead_1' } },
      data: { status: 'rejected', nextActionAt: null, nextFollowUpAt: null }
    });
    expect(tx.task.create).not.toHaveBeenCalled();
    expect(result.task).toBeNull();
  });

  it('matches the unsubscribe sender within the company when the mail has no contact', async () => {
    const { useCase, tx } = createSubject({
      id: 'mail_1', organizationId, companyId: 'company_1', contactId: null, leadId: 'lead_1'
    });

    await useCase.execute('mail_1', {
      fromEmail: 'CONTACT@EXAMPLE.COM',
      body: '今後の連絡は不要です。メールを停止してください。',
      receivedAt
    }, actor);

    expect(tx.contactPerson.updateMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company_1',
        organizationId,
        email: { equals: 'CONTACT@EXAMPLE.COM', mode: 'insensitive' },
        deletedAt: null
      },
      data: { isUnsubscribed: true, unsubscribedAt: new Date(receivedAt), isPrimary: false }
    });
  });

  it('rejects an unknown mail before writing reply data', async () => {
    const { useCase, tx } = createSubject(null);

    await expect(useCase.execute('missing', { body: '確認しました。' }, actor)).rejects.toThrow(NotFoundException);
    expect(tx.emailReply.create).not.toHaveBeenCalled();
  });

  it('rejects an immediate duplicate before creating another task', async () => {
    const { useCase, tx } = createSubject();
    tx.emailReply.findFirst.mockResolvedValue({ id: 'reply_existing' });

    await expect(useCase.execute('mail_1', {
      fromEmail: 'contact@example.com',
      body: '確認しました。'
    }, actor)).rejects.toThrow('同じ返信はすでに記録されています。');

    expect(tx.emailReply.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId, emailId: 'mail_1' })
    }));
    expect(tx.emailReply.create).not.toHaveBeenCalled();
    expect(tx.task.create).not.toHaveBeenCalled();
  });

  it('does not disclose a reply source mail from another organization', async () => {
    const { useCase, tx } = createSubject(null);

    await expect(useCase.execute('mail_other', { body: '確認しました。' }, actor)).rejects.toThrow(NotFoundException);
    expect(tx.outreachEmail.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'mail_other', organizationId }
    }));
    expect(tx.emailReply.create).not.toHaveBeenCalled();
  });
});
