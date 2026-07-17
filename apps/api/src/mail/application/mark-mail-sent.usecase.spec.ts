import { MarkMailSentUseCase } from './mark-mail-sent.usecase';

describe('MarkMailSentUseCase', () => {
  it('records manual recovery when a sending mail was verified externally', async () => {
    const mails = {
      get: jest.fn().mockResolvedValue({ id: 'mail_1', status: 'sending' }),
      transitionIfDeliveryAllowed: jest.fn().mockResolvedValue({ id: 'mail_1', status: 'sent' })
    };
    const useCase = new MarkMailSentUseCase(mails as any);

    await expect(useCase.execute('mail_1', {})).resolves.toEqual({ id: 'mail_1', status: 'sent' });
    expect(mails.transitionIfDeliveryAllowed).toHaveBeenCalledWith(
      'mail_1',
      'sent',
      'sent',
      { sentAt: expect.any(Date) },
      { manual: true, recoveredFrom: 'sending' }
    );
  });
});
