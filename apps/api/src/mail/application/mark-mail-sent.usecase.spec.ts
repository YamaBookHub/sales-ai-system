import { MarkMailSentUseCase } from './mark-mail-sent.usecase';

describe('MarkMailSentUseCase', () => {
  const actor = { userId: 'user_1', sessionId: 'session_1', organizationId: 'org_1' };
  it('records manual recovery when a sending mail was verified externally', async () => {
    const mails = {
      get: jest.fn().mockResolvedValue({ id: 'mail_1', status: 'sending' }),
      transitionIfDeliveryAllowed: jest.fn().mockResolvedValue({ id: 'mail_1', status: 'sent' })
    };
    const useCase = new MarkMailSentUseCase(mails as any);

    await expect(useCase.execute('mail_1', {}, actor)).resolves.toEqual({ id: 'mail_1', status: 'sent' });
    expect(mails.transitionIfDeliveryAllowed).toHaveBeenCalledWith(
      'mail_1',
      'sent',
      'sent',
      { sentAt: expect.any(Date) },
      { manual: true, recoveredFrom: 'sending' }, actor
    );
  });
});
