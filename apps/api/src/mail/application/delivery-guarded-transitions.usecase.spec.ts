import { ApproveMailUseCase } from './approve-mail.usecase';
import { MarkMailSentUseCase } from './mark-mail-sent.usecase';
import { QueueMailUseCase } from './queue-mail.usecase';
import { RequestMailReReviewUseCase } from './request-mail-rereview.usecase';
import { RequestMailReviewUseCase } from './request-mail-review.usecase';
import { RetryMailUseCase } from './retry-mail.usecase';

describe('delivery-guarded mail transitions', () => {
  const guardedRepository = () => ({
    get: jest.fn().mockResolvedValue({ id: 'mail_1', status: 'approved' }),
    checklistComplete: jest.fn().mockResolvedValue(true),
    transitionIfDeliveryAllowed: jest.fn().mockResolvedValue({ id: 'mail_1' })
  });

  it('guards review requests before changing status', async () => {
    const mails = guardedRepository();
    await new RequestMailReviewUseCase(mails as any).execute('mail_1');
    expect(mails.transitionIfDeliveryAllowed).toHaveBeenCalledWith('mail_1', 'in_review', 'reviewed');
  });

  it('guards approvals before changing status', async () => {
    const mails = guardedRepository();
    await new ApproveMailUseCase(mails as any).execute('mail_1');
    expect(mails.transitionIfDeliveryAllowed).toHaveBeenCalledWith(
      'mail_1', 'approved', 'approved', { approvedAt: expect.any(Date) }
    );
  });

  it('guards re-review requests before changing status', async () => {
    const mails = guardedRepository();
    mails.get.mockResolvedValue({ id: 'mail_1', status: 'rejected' });
    await new RequestMailReReviewUseCase(mails as any).execute('mail_1');
    expect(mails.transitionIfDeliveryAllowed).toHaveBeenCalledWith(
      'mail_1',
      'in_review',
      'reviewed',
      { failedReason: null },
      { reReview: true }
    );
  });

  it('guards queueing before changing status', async () => {
    const mails = guardedRepository();
    await new QueueMailUseCase(mails as any).execute('mail_1');
    expect(mails.transitionIfDeliveryAllowed).toHaveBeenCalledWith('mail_1', 'queued', 'queued');
  });

  it('guards manual sent records before changing status', async () => {
    const mails = guardedRepository();
    await new MarkMailSentUseCase(mails as any).execute('mail_1', {});
    expect(mails.transitionIfDeliveryAllowed).toHaveBeenCalledWith(
      'mail_1', 'sent', 'sent', { sentAt: expect.any(Date) }, { manual: true }
    );
  });

  it('guards retries before returning a failed email to the queue', async () => {
    const mails = guardedRepository();
    mails.get.mockResolvedValue({ id: 'mail_1', status: 'failed' });
    await new RetryMailUseCase(mails as any).execute('mail_1');
    expect(mails.transitionIfDeliveryAllowed).toHaveBeenCalledWith(
      'mail_1',
      'queued',
      'retried',
      { retryCount: { increment: 1 } }
    );
  });
});
