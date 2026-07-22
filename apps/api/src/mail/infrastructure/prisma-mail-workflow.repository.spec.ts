import { ConflictException, NotFoundException } from '@nestjs/common';
import { mailAuditActionForTransition, PrismaMailWorkflowRepository, safeMailFailureReason } from './prisma-mail-workflow.repository';

describe('PrismaMailWorkflowRepository', () => {
  const organizationId = 'org_1';
  const actor = { userId: 'user_1', sessionId: 'session_1', organizationId };

  it.each([
    ['in_review', 'reviewed', undefined, 'mail.review_requested'],
    ['in_review', 'reviewed', { reReview: true }, 'mail.rereview_requested'],
    ['rejected', 'rejected', undefined, 'mail.rejected'],
    ['approved', 'approved', undefined, 'mail.approved'],
    ['queued', 'queued', undefined, 'mail.queued'],
    ['queued', 'retried', undefined, 'mail.retried'],
    ['sent', 'sent', { manual: true }, 'mail.marked_sent'],
    ['sent', 'sent', undefined, 'mail.sent'],
    ['failed', 'failed', undefined, 'mail.send_failed']
  ])('maps %s/%s to the stable %s audit action', (status, eventType, payload, action) => {
    expect(mailAuditActionForTransition(status as any, eventType as any, payload as any)).toBe(action);
  });

  it('does not disclose a mail from another organization', async () => {
    const prisma = { outreachEmail: { findFirst: jest.fn().mockResolvedValue(null) } };
    const repository = new PrismaMailWorkflowRepository(prisma as any);

    await expect(repository.get('mail_other', organizationId)).rejects.toThrow(NotFoundException);
    expect(prisma.outreachEmail.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'mail_other', organizationId }
    }));
  });

  it('claims queued mail for sending atomically within the organization', async () => {
    const mail = {
      id: 'mail_1',
      status: 'queued',
      companyId: 'company_1',
      contactId: null,
      toEmail: 'to@example.com',
      destinationType: null,
      destinationValue: null,
      destinationKey: null,
      company: { isBlocked: false, inquiryUrl: null },
      contact: null,
      lead: { sendMethod: 'email', contactEmail: null, contactFormUrl: null, siteMessageUrl: null }
    };
    const tx = {
      outreachEmail: {
        findFirst: jest.fn().mockResolvedValue(mail),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: jest.fn().mockResolvedValue({ ...mail, status: 'sending' })
      },
      contactPerson: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0) },
      emailEvent: { create: jest.fn() },
      auditLog: { create: jest.fn() },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const repository = new PrismaMailWorkflowRepository(prisma as any);

    await expect(repository.claimForSending('mail_1', 'key_1', actor)).resolves.toMatchObject({
      id: 'mail_1',
      status: 'sending'
    });
    expect(tx.outreachEmail.updateMany).toHaveBeenCalledWith({
      where: { id: 'mail_1', organizationId, status: 'queued' },
      data: {
        status: 'sending',
        destinationType: 'email',
        destinationValue: 'to@example.com',
        destinationKey: 'email:to@example.com'
      }
    });
    expect(tx.outreachEmail.findFirstOrThrow).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'mail_1', organizationId }
    }));
    expect(tx.emailEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        emailId: 'mail_1',
        type: 'sending',
        payload: { idempotencyKey: 'key_1', actorUserId: actor.userId }
      })
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        userId: actor.userId,
        sessionId: actor.sessionId,
        action: 'mail.send_started',
        entityId: 'mail_1'
      })
    });
  });

  it('rejects claim when mail is not queued anymore without writing events', async () => {
    const mail = {
      id: 'mail_1', companyId: 'company_1', contactId: null, toEmail: 'to@example.com',
      destinationType: null, destinationValue: null, destinationKey: null,
      company: { isBlocked: false, inquiryUrl: null }, contact: null,
      lead: { sendMethod: 'email', contactEmail: null, contactFormUrl: null, siteMessageUrl: null }
    };
    const tx = {
      outreachEmail: {
        findFirst: jest.fn().mockResolvedValue(mail),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirstOrThrow: jest.fn()
      },
      contactPerson: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0) },
      emailEvent: { create: jest.fn() },
      auditLog: { create: jest.fn() },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    };
    const repository = new PrismaMailWorkflowRepository({
      $transaction: jest.fn((callback) => callback(tx))
    } as any);

    await expect(repository.claimForSending('mail_1', 'key_1', actor)).rejects.toThrow(ConflictException);
    expect(tx.outreachEmail.findFirstOrThrow).not.toHaveBeenCalled();
    expect(tx.emailEvent.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('records the actor on successful and failed send events', async () => {
    const tx = {
      outreachEmail: {
        findFirst: jest.fn().mockResolvedValue({ status: 'sending', organizationId, leadId: null }),
        update: jest.fn()
          .mockResolvedValueOnce({ id: 'mail_1', leadId: null, status: 'sent' })
          .mockResolvedValueOnce({ id: 'mail_1', leadId: null, status: 'failed' })
      },
      auditLog: { create: jest.fn() }
    };
    const repository = new PrismaMailWorkflowRepository({
      $transaction: jest.fn((callback) => callback(tx))
    } as any);
    const sentAt = new Date('2026-07-11T00:00:00.000Z');

    await repository.markSentAfterSend(
      'mail_1',
      { provider: 'test', messageId: 'message_1', threadId: 'thread_1', sentAt },
      'key_1',
      actor
    );
    await repository.markFailedAfterSend('mail_1', new Error('本文 secret-body test@example.com 192.168.1.1'), 'key_2', actor);

    expect(tx.outreachEmail.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { organizationId_id: { organizationId, id: 'mail_1' } },
      data: expect.objectContaining({
        status: 'sent',
        provider: 'test',
        gmailMessageId: 'message_1',
        gmailThreadId: 'thread_1',
        sentAt,
        failedReason: null,
        events: { create: expect.objectContaining({ type: 'sent' }) }
      })
    }));
    expect(tx.outreachEmail.update).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { organizationId_id: { organizationId, id: 'mail_1' } },
      data: expect.objectContaining({
        status: 'failed',
        failedReason: '送信に失敗しました。',
        events: { create: expect.objectContaining({ type: 'failed' }) }
      })
    }));
    expect(tx.auditLog.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ organizationId, userId: actor.userId, sessionId: actor.sessionId, action: 'mail.sent', entityId: 'mail_1' })
    });
    expect(tx.auditLog.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ organizationId, userId: actor.userId, sessionId: actor.sessionId, action: 'mail.send_failed', entityId: 'mail_1' })
    });
  });

  it('builds a safe persisted failure reason without provider response data', () => {
    const error = Object.assign(new Error('本文 secret-body test@example.com 192.168.1.1'), { code: 'ECONNRESET' });

    expect(safeMailFailureReason(error)).toBe('送信に失敗しました（code: ECONNRESET）。');
    expect(safeMailFailureReason({ getStatus: () => 503, message: 'secret@example.com' })).toBe('送信に失敗しました（status: 503）。');
    expect(safeMailFailureReason(Object.assign(new Error('provider failed'), { code: 'SECRET-TOKEN-123' }))).toBe('送信に失敗しました。');
    expect(safeMailFailureReason(error)).not.toContain('secret');
  });

  it('rejects a legacy email when its matching address is unsubscribed', async () => {
    const tx = {
      outreachEmail: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mail_1', companyId: 'company_1', contactId: null, toEmail: 'to@example.com',
          destinationType: null, destinationValue: null, destinationKey: null,
          company: { isBlocked: false, inquiryUrl: null }, contact: null,
          lead: { sendMethod: 'email', contactEmail: null, contactFormUrl: null, siteMessageUrl: null }
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn()
      },
      contactPerson: {
        findFirst: jest.fn().mockResolvedValue({ deletedAt: null, isUnsubscribed: true }),
        count: jest.fn().mockResolvedValue(1)
      },
      emailEvent: { create: jest.fn() },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    };
    const repository = new PrismaMailWorkflowRepository({
      $transaction: jest.fn((callback) => callback(tx))
    } as any);

    await expect(repository.transitionIfDeliveryAllowed(
      'mail_1', 'in_review', 'reviewed', {}, undefined, actor
    )).rejects.toThrow(ConflictException);
    expect(tx.outreachEmail.update).not.toHaveBeenCalled();
    expect(tx.contactPerson.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: 'company_1',
        organizationId,
        email: { equals: 'to@example.com', mode: 'insensitive' },
        OR: [{ deletedAt: { not: null } }, { isUnsubscribed: true }]
      },
      select: { deletedAt: true, isUnsubscribed: true }
    });
  });

  it('rejects a recipient-less email when every registered contact is unsubscribed', async () => {
    const tx = {
      outreachEmail: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mail_1', companyId: 'company_1', contactId: null, toEmail: null,
          destinationType: null, destinationValue: null, destinationKey: null,
          company: { isBlocked: false, inquiryUrl: null }, contact: null,
          lead: { sendMethod: 'email', contactEmail: null, contactFormUrl: null, siteMessageUrl: null }
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn()
      },
      contactPerson: {
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(0)
      },
      emailEvent: { create: jest.fn() },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    };
    const repository = new PrismaMailWorkflowRepository({
      $transaction: jest.fn((callback) => callback(tx))
    } as any);

    await expect(repository.transitionIfDeliveryAllowed(
      'mail_1', 'in_review', 'reviewed', {}, undefined, actor
    )).rejects.toThrow(ConflictException);
    expect(tx.outreachEmail.update).not.toHaveBeenCalled();
  });

  it('rejects a saved recipient address after the linked contact email changes', async () => {
    const tx = {
      outreachEmail: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mail_1', companyId: 'company_1', contactId: 'contact_1', toEmail: 'old@example.com',
          destinationType: null, destinationValue: null, destinationKey: null,
          company: { isBlocked: false, inquiryUrl: null },
          contact: { deletedAt: null, isUnsubscribed: false, email: 'new@example.com', inquiryUrl: null },
          lead: { sendMethod: 'email', contactEmail: null, contactFormUrl: null, siteMessageUrl: null }
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn()
      },
      contactPerson: { findFirst: jest.fn(), count: jest.fn() },
      emailEvent: { create: jest.fn() },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    };
    const repository = new PrismaMailWorkflowRepository({
      $transaction: jest.fn((callback) => callback(tx))
    } as any);

    await expect(repository.transitionIfDeliveryAllowed(
      'mail_1', 'in_review', 'reviewed', {}, undefined, actor
    )).rejects.toThrow(ConflictException);
    expect(tx.outreachEmail.update).not.toHaveBeenCalled();
  });

  it('rejects review when another mail reserves the same normalized destination', async () => {
    const current = {
      id: 'mail_1', organizationId, companyId: 'company_1', contactId: 'contact_1', toEmail: 'sales@example.com',
      destinationType: 'email', destinationValue: 'sales@example.com', destinationKey: 'email:sales@example.com',
      company: { isBlocked: false, inquiryUrl: null },
      contact: { deletedAt: null, isUnsubscribed: false, email: 'sales@example.com', inquiryUrl: null },
      lead: { sendMethod: 'email', contactEmail: null, contactFormUrl: null, siteMessageUrl: null }
    };
    const tx = {
      outreachEmail: {
        findFirst: jest.fn().mockResolvedValue(current),
        findMany: jest.fn().mockResolvedValue([{
          organizationId,
          status: 'queued',
          sentAt: null,
          toEmail: ' SALES@EXAMPLE.COM ',
          destinationType: 'email',
          destinationValue: 'sales@example.com',
          destinationKey: 'email:sales@example.com',
          contact: null,
          company: { inquiryUrl: null },
          lead: null
        }]),
        update: jest.fn()
      },
      contactPerson: { findFirst: jest.fn(), count: jest.fn() },
      emailEvent: { create: jest.fn() },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    };
    const repository = new PrismaMailWorkflowRepository({
      $transaction: jest.fn((callback) => callback(tx))
    } as any);

    await expect(repository.transitionIfDeliveryAllowed(
      'mail_1', 'in_review', 'reviewed', {}, undefined, actor
    )).rejects.toThrow('重複接触');
    expect(tx.outreachEmail.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId })
    }));
    expect(tx.outreachEmail.update).not.toHaveBeenCalled();
    expect(tx.emailEvent.create).not.toHaveBeenCalled();
  });
});
