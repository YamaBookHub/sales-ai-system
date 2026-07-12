import { ConflictException } from '@nestjs/common';
import { PrismaMailWorkflowRepository } from './prisma-mail-workflow.repository';

describe('PrismaMailWorkflowRepository', () => {
  it('claims queued mail for sending atomically', async () => {
    const tx = {
      outreachEmail: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'mail_1', status: 'sending' })
      },
      emailEvent: {
        create: jest.fn()
      }
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx))
    };
    const repository = new PrismaMailWorkflowRepository(prisma as any);

    await expect(repository.claimForSending('mail_1', 'key_1')).resolves.toEqual({ id: 'mail_1', status: 'sending' });
    expect(tx.outreachEmail.updateMany).toHaveBeenCalledWith({
      where: { id: 'mail_1', status: 'queued' },
      data: { status: 'sending' }
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
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn()
      },
      emailEvent: {
        create: jest.fn()
      }
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx))
    };
    const repository = new PrismaMailWorkflowRepository(prisma as any);

    await expect(repository.claimForSending('mail_1', 'key_1')).rejects.toThrow(ConflictException);
    expect(tx.outreachEmail.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(tx.emailEvent.create).not.toHaveBeenCalled();
  });
});
