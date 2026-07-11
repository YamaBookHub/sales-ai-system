import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { SendQueuedMailUseCase } from './send-queued-mail.usecase';

describe('SendQueuedMailUseCase', () => {
  const email = {
    id: 'mail_1',
    status: 'queued',
    retryCount: 0,
    toEmail: 'to@example.com',
    subject: '件名',
    body: '本文'
  };

  const createDeps = () => {
    const mails = {
      get: jest.fn().mockResolvedValue(email),
      checklistComplete: jest.fn().mockResolvedValue(true),
      claimForSending: jest.fn().mockResolvedValue({ ...email, status: 'sending' }),
      markSentAfterSend: jest.fn().mockResolvedValue({ ...email, status: 'sent' }),
      markFailedAfterSend: jest.fn().mockResolvedValue({ ...email, status: 'failed' })
    };
    const sender = {
      send: jest.fn().mockResolvedValue({
        provider: 'test',
        messageId: 'message_1',
        threadId: 'thread_1',
        sentAt: new Date('2026-07-11T00:00:00.000Z')
      })
    };

    return { mails, sender };
  };

  it('sends only queued mail with complete checklist and marks it sent', async () => {
    const { mails, sender } = createDeps();
    const useCase = new SendQueuedMailUseCase(mails as any, sender as any);

    await expect(useCase.execute(email.id)).resolves.toEqual({ ...email, status: 'sent' });
    expect(mails.claimForSending).toHaveBeenCalledWith(email.id, 'mail:mail_1:retry:0');
    expect(sender.send).toHaveBeenCalledWith({
      idempotencyKey: 'mail:mail_1:retry:0',
      toEmail: 'to@example.com',
      subject: '件名',
      body: '本文'
    });
    expect(mails.markSentAfterSend).toHaveBeenCalledWith(
      email.id,
      expect.objectContaining({ provider: 'test', messageId: 'message_1', threadId: 'thread_1' }),
      'mail:mail_1:retry:0'
    );
  });

  it('does not send before queue', async () => {
    const { mails, sender } = createDeps();
    mails.get.mockResolvedValue({ ...email, status: 'approved' });
    const useCase = new SendQueuedMailUseCase(mails as any, sender as any);

    await expect(useCase.execute(email.id)).rejects.toThrow(ConflictException);
    expect(mails.claimForSending).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('does not send with incomplete checklist', async () => {
    const { mails, sender } = createDeps();
    mails.checklistComplete.mockResolvedValue(false);
    const useCase = new SendQueuedMailUseCase(mails as any, sender as any);

    await expect(useCase.execute(email.id)).rejects.toThrow(ConflictException);
    expect(mails.claimForSending).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('marks failed when sender fails after sending lock is taken', async () => {
    const { mails, sender } = createDeps();
    sender.send.mockRejectedValue(new ServiceUnavailableException('provider missing'));
    const useCase = new SendQueuedMailUseCase(mails as any, sender as any);

    await expect(useCase.execute(email.id)).rejects.toThrow(ServiceUnavailableException);
    expect(mails.claimForSending).toHaveBeenCalledWith(email.id, 'mail:mail_1:retry:0');
    expect(mails.markFailedAfterSend).toHaveBeenCalledWith(email.id, expect.any(ServiceUnavailableException), 'mail:mail_1:retry:0');
  });

  it('does not call sender when sending claim fails', async () => {
    const { mails, sender } = createDeps();
    mails.claimForSending.mockRejectedValue(new ConflictException('already sending'));
    const useCase = new SendQueuedMailUseCase(mails as any, sender as any);

    await expect(useCase.execute(email.id)).rejects.toThrow(ConflictException);
    expect(sender.send).not.toHaveBeenCalled();
    expect(mails.markFailedAfterSend).not.toHaveBeenCalled();
  });
});
