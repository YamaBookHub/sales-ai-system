import { ConflictException } from '@nestjs/common';
import { PrismaMailWorkflowRepository } from './prisma-mail-workflow.repository';

describe('PrismaMailWorkflowRepository', () => {
  it('claims queued mail for sending atomically', async () => {
    const tx = {
      outreachEmail: {
        findUnique: jest.fn().mockResolvedValue({
          companyId: 'company_1', contactId: null, toEmail: 'to@example.com',
          company: { isBlocked: false }, contact: null
        }),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'mail_1', status: 'sending' })
      },
      contactPerson: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0)
      },
      emailEvent: {
        create: jest.fn()
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx))
    };
    const repository = new PrismaMailWorkflowRepository(prisma as any);

    await expect(repository.claimForSending('mail_1', 'key_1')).resolves.toEqual({ id: 'mail_1', status: 'sending' });
    expect(tx.outreachEmail.updateMany).toHaveBeenCalledWith({
      where: { id: 'mail_1', status: 'queued' },
      data: {
        status: 'sending',
        destinationType: 'email',
        destinationValue: 'to@example.com',
        destinationKey: 'email:to@example.com'
      }
    });
    expect(tx.outreachEmail.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'mail_1' },
      include: {
        lead: {
          select: {
            sendMethod: true,
            contactFormUrl: true,
            siteMessageUrl: true
          }
        }
      }
    });
    expect(tx.emailEvent.create).toHaveBeenCalledWith({
      data: {
        emailId: 'mail_1',
        type: 'sending',
        payload: { idempotencyKey: 'key_1' }
      }
    });
  });

  it('rejects claim when mail is not queued anymore', async () => {
    const tx = {
      outreachEmail: {
        findUnique: jest.fn().mockResolvedValue({
          companyId: 'company_1', contactId: null, toEmail: 'to@example.com',
          company: { isBlocked: false }, contact: null
        }),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn()
      },
      contactPerson: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0)
      },
      emailEvent: {
        create: jest.fn()
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx))
    };
    const repository = new PrismaMailWorkflowRepository(prisma as any);

    await expect(repository.claimForSending('mail_1', 'key_1')).rejects.toThrow(ConflictException);
    expect(tx.outreachEmail.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(tx.emailEvent.create).not.toHaveBeenCalled();
  });

  it('rejects a legacy email when its matching address is unsubscribed', async () => {
    const tx = {
      outreachEmail: {
        findUnique: jest.fn().mockResolvedValue({
          companyId: 'company_1', contactId: null, toEmail: 'to@example.com',
          company: { isBlocked: false }, contact: null
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn()
      },
      contactPerson: {
        findFirst: jest.fn().mockResolvedValue({ deletedAt: null, isUnsubscribed: true }),
        count: jest.fn().mockResolvedValue(1)
      },
      salesLead: { update: jest.fn() },
      emailEvent: { create: jest.fn() },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const repository = new PrismaMailWorkflowRepository(prisma as any);

    await expect(repository.transitionIfDeliveryAllowed('mail_1', 'in_review', 'reviewed')).rejects.toThrow(ConflictException);
    expect(tx.outreachEmail.update).not.toHaveBeenCalled();
    expect(tx.contactPerson.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: 'company_1',
        email: { equals: 'to@example.com', mode: 'insensitive' },
        OR: [{ deletedAt: { not: null } }, { isUnsubscribed: true }]
      },
      select: { deletedAt: true, isUnsubscribed: true }
    });
  });

  it('rejects a recipient-less email when every registered contact is unsubscribed', async () => {
    const tx = {
      outreachEmail: {
        findUnique: jest.fn().mockResolvedValue({
          companyId: 'company_1', contactId: null, toEmail: null,
          company: { isBlocked: false }, contact: null
        }),
        update: jest.fn()
      },
      contactPerson: {
        findFirst: jest.fn(),
        count: jest.fn()
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(0)
      },
      salesLead: { update: jest.fn() },
      emailEvent: { create: jest.fn() },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const repository = new PrismaMailWorkflowRepository(prisma as any);

    await expect(repository.transitionIfDeliveryAllowed('mail_1', 'in_review', 'reviewed'))
      .rejects.toThrow(ConflictException);
    expect(tx.outreachEmail.update).not.toHaveBeenCalled();
  });

  it('rejects a saved recipient address after the linked contact email changes', async () => {
    const tx = {
      outreachEmail: {
        findUnique: jest.fn().mockResolvedValue({
          companyId: 'company_1',
          contactId: 'contact_1',
          toEmail: 'old@example.com',
          company: { isBlocked: false },
          contact: { deletedAt: null, isUnsubscribed: false, email: 'new@example.com' }
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn()
      },
      contactPerson: { findFirst: jest.fn(), count: jest.fn() },
      salesLead: { update: jest.fn() },
      emailEvent: { create: jest.fn() },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const repository = new PrismaMailWorkflowRepository(prisma as any);

    await expect(repository.transitionIfDeliveryAllowed('mail_1', 'in_review', 'reviewed'))
      .rejects.toThrow(ConflictException);
    expect(tx.outreachEmail.update).not.toHaveBeenCalled();
  });

  it('rejects review when another mail reserves the same normalized destination', async () => {
    const current = {
      id: 'mail_1',
      companyId: 'company_1',
      contactId: 'contact_1',
      toEmail: 'sales@example.com',
      destinationType: 'email',
      destinationValue: 'sales@example.com',
      destinationKey: 'email:sales@example.com',
      company: { isBlocked: false, inquiryUrl: null },
      contact: {
        deletedAt: null,
        isUnsubscribed: false,
        email: 'sales@example.com',
        inquiryUrl: null
      },
      lead: { sendMethod: 'email', contactEmail: null, contactFormUrl: null, siteMessageUrl: null }
    };
    const tx = {
      outreachEmail: {
        findUnique: jest.fn().mockResolvedValue(current),
        findMany: jest.fn().mockResolvedValue([{
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
      salesLead: { update: jest.fn() },
      emailEvent: { create: jest.fn() },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1)
    };
    const repository = new PrismaMailWorkflowRepository({
      $transaction: jest.fn((callback) => callback(tx))
    } as any);

    await expect(repository.transitionIfDeliveryAllowed('mail_1', 'in_review', 'reviewed'))
      .rejects.toThrow('重複接触');

    expect(tx.outreachEmail.update).not.toHaveBeenCalled();
    expect(tx.salesLead.update).not.toHaveBeenCalled();
    expect(tx.emailEvent.create).not.toHaveBeenCalled();
  });
});
