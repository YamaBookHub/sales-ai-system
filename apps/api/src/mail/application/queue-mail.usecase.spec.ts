import { ConflictException } from '@nestjs/common';
import { QueueMailUseCase } from './queue-mail.usecase';

describe('QueueMailUseCase', () => {
  const actor = { userId: 'user_1', sessionId: 'session_1', organizationId: 'org_1' };
  const createRepository = (status: string, checklistComplete: boolean) => ({
    get: jest.fn().mockResolvedValue({ id: 'mail_1', status }),
    checklistComplete: jest.fn().mockResolvedValue(checklistComplete),
    transitionIfDeliveryAllowed: jest.fn().mockResolvedValue({ id: 'mail_1', status: 'queued' })
  });

  it('queues approved mail with a complete checklist', async () => {
    const repository = createRepository('approved', true);
    const useCase = new QueueMailUseCase(repository as any);

    await expect(useCase.execute('mail_1', actor)).resolves.toEqual({ id: 'mail_1', status: 'queued' });
    expect(repository.transitionIfDeliveryAllowed).toHaveBeenCalledWith('mail_1', 'queued', 'queued', {}, undefined, actor);
  });

  it('does not queue mail before approval', async () => {
    const repository = createRepository('draft', true);
    const useCase = new QueueMailUseCase(repository as any);

    await expect(useCase.execute('mail_1', actor)).rejects.toThrow(ConflictException);
    expect(repository.transitionIfDeliveryAllowed).not.toHaveBeenCalled();
  });

  it('does not queue mail with an incomplete checklist', async () => {
    const repository = createRepository('approved', false);
    const useCase = new QueueMailUseCase(repository as any);

    await expect(useCase.execute('mail_1', actor)).rejects.toThrow(ConflictException);
    expect(repository.transitionIfDeliveryAllowed).not.toHaveBeenCalled();
  });
});
