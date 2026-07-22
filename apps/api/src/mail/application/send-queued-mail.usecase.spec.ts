import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { SendQueuedMailUseCase } from './send-queued-mail.usecase';

describe('SendQueuedMailUseCase', () => {
  const actor = { userId: 'user_1', sessionId: 'session_1', organizationId: 'org_1' };
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
      assertDeliveryAllowed: jest.fn().mockResolvedValue(undefined),
      markSentAfterSend: jest.fn().mockResolvedValue({ ...email, status: 'sent' }),
      markFailedAfterSend: jest.fn().mockResolvedValue({ ...email, status: 'failed' })
    };
    const sender = {
      validate: jest.fn(),
      send: jest.fn().mockResolvedValue({
        provider: 'test',
        messageId: 'message_1',
        threadId: 'thread_1',
        sentAt: new Date('2026-07-11T00:00:00.000Z')
      })
    };

    const logger = { errorEvent: jest.fn() };
    return { mails, sender, logger };
  };

  const useCaseFor = (mails: unknown, sender: unknown, logger: unknown) =>
    new SendQueuedMailUseCase(mails as any, sender as any, logger as any);

  it('sends only queued mail with complete checklist and marks it sent', async () => {
    const { mails, sender, logger } = createDeps();
    const useCase = useCaseFor(mails, sender, logger);

    await expect(useCase.execute(email.id, actor)).resolves.toEqual({ ...email, status: 'sent' });
    expect(mails.claimForSending).toHaveBeenCalledWith(email.id, 'mail:mail_1:retry:0', actor);
    expect(sender.send).toHaveBeenCalledWith({
      idempotencyKey: 'mail:mail_1:retry:0',
      toEmail: 'to@example.com',
      subject: '件名',
      body: '本文'
    });
    expect(mails.markSentAfterSend).toHaveBeenCalledWith(
      email.id,
      expect.objectContaining({ provider: 'test', messageId: 'message_1', threadId: 'thread_1' }),
      'mail:mail_1:retry:0',
      actor
    );
  });

  it('does not send before queue', async () => {
    const { mails, sender, logger } = createDeps();
    mails.get.mockResolvedValue({ ...email, status: 'approved' });
    const useCase = useCaseFor(mails, sender, logger);

    await expect(useCase.execute(email.id, actor)).rejects.toThrow(ConflictException);
    expect(mails.claimForSending).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('does not send with incomplete checklist', async () => {
    const { mails, sender, logger } = createDeps();
    mails.checklistComplete.mockResolvedValue(false);
    const useCase = useCaseFor(mails, sender, logger);

    await expect(useCase.execute(email.id, actor)).rejects.toThrow(ConflictException);
    expect(mails.claimForSending).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('marks failed when sender fails after sending lock is taken', async () => {
    const { mails, sender, logger } = createDeps();
    sender.send.mockRejectedValue(new ServiceUnavailableException('provider missing'));
    const useCase = useCaseFor(mails, sender, logger);

    await expect(useCase.execute(email.id, actor)).rejects.toThrow(ServiceUnavailableException);
    expect(mails.claimForSending).toHaveBeenCalledWith(email.id, 'mail:mail_1:retry:0', actor);
    expect(mails.markFailedAfterSend).toHaveBeenCalledWith(
      email.id,
      expect.any(ServiceUnavailableException),
      'mail:mail_1:retry:0',
      actor
    );
    expect(logger.errorEvent).toHaveBeenCalledWith('mail.send_failed', {
      userId: actor.userId,
      organizationId: actor.organizationId,
      entityType: 'OutreachEmail',
      entityId: email.id,
      operation: 'send',
      error: expect.any(ServiceUnavailableException)
    });
  });

  it('does not call sender when sending claim fails', async () => {
    const { mails, sender, logger } = createDeps();
    mails.claimForSending.mockRejectedValue(new ConflictException('already sending'));
    const useCase = useCaseFor(mails, sender, logger);

    await expect(useCase.execute(email.id, actor)).rejects.toThrow(ConflictException);
    expect(sender.send).not.toHaveBeenCalled();
    expect(mails.markFailedAfterSend).not.toHaveBeenCalled();
  });

  it('does not call sender when the contact stops delivery after the claim', async () => {
    const { mails, sender, logger } = createDeps();
    mails.assertDeliveryAllowed.mockRejectedValue(new ConflictException('unsubscribed'));
    const useCase = useCaseFor(mails, sender, logger);

    await expect(useCase.execute(email.id, actor)).rejects.toThrow(ConflictException);
    expect(sender.send).not.toHaveBeenCalled();
    expect(mails.markFailedAfterSend).toHaveBeenCalledWith(
      email.id,
      expect.any(ConflictException),
      'mail:mail_1:retry:0',
      actor
    );
  });

  it('does not claim a queued non-email channel when the provider rejects it', async () => {
    const { mails, sender, logger } = createDeps();
    mails.get.mockResolvedValue({ ...email, lead: { sendMethod: 'site_message' } });
    sender.validate = jest.fn().mockImplementation(() => {
      throw new ServiceUnavailableException('site provider missing');
    });
    const useCase = useCaseFor(mails, sender, logger);

    await expect(useCase.execute(email.id, actor)).rejects.toThrow(ServiceUnavailableException);
    expect(sender.validate).toHaveBeenCalledWith(expect.objectContaining({ sendMethod: 'site_message' }));
    expect(mails.claimForSending).not.toHaveBeenCalled();
    expect(mails.markFailedAfterSend).not.toHaveBeenCalled();
  });
});
