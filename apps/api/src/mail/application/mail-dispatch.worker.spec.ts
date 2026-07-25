import { MailDispatchWorker } from './mail-dispatch.worker';

describe('MailDispatchWorker', () => {
  const createDeps = () => {
    const tx = {
      outreachEmail: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      emailEvent: { create: jest.fn() },
      auditLog: { create: jest.fn() }
    };
    const prisma = {
      outreachEmail: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mail_1',
          organizationId: 'org_1',
          approvedById: 'user_1'
        }),
        findMany: jest.fn().mockResolvedValue([])
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    };
    const send = { execute: jest.fn().mockResolvedValue({ id: 'mail_1', status: 'sent' }) };
    const logger = { warnEvent: jest.fn() };
    return { tx, prisma, send, logger };
  };

  it('dispatches one durable queued mail with the approving user as audit actor', async () => {
    const { prisma, send, logger } = createDeps();
    const worker = new MailDispatchWorker(prisma as any, send as any, logger as any);

    await expect(worker.runOnce(new Date('2026-07-25T00:00:00.000Z'))).resolves.toEqual({
      dispatched: true,
      recovered: 0
    });
    expect(send.execute).toHaveBeenCalledWith('mail_1', {
      organizationId: 'org_1',
      userId: 'user_1'
    });
  });

  it('moves an abandoned sending claim to an explicit uncertain failure without retrying it', async () => {
    const { tx, prisma, send, logger } = createDeps();
    prisma.outreachEmail.findMany.mockResolvedValueOnce([
      { id: 'stale_1', organizationId: 'org_1', approvedById: 'user_1' }
    ]);
    prisma.outreachEmail.findFirst.mockResolvedValueOnce(null);
    const worker = new MailDispatchWorker(prisma as any, send as any, logger as any);

    await expect(worker.runOnce(new Date('2026-07-25T00:30:00.000Z'))).resolves.toEqual({
      dispatched: false,
      recovered: 1
    });
    expect(tx.outreachEmail.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'stale_1', status: 'sending' }),
      data: expect.objectContaining({ status: 'failed' })
    }));
    expect(tx.emailEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        emailId: 'stale_1',
        type: 'failed',
        payload: expect.objectContaining({ deliveryOutcomeUnknown: true })
      })
    });
    expect(send.execute).not.toHaveBeenCalled();
  });
});
