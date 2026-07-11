import { ConflictException } from '@nestjs/common';
import { QueueMailUseCase } from './queue-mail.usecase';

describe('QueueMailUseCase', () => {
  const createRepository = (status: string, checklistComplete: boolean) => ({
    get: jest.fn().mockResolvedValue({ id: 'mail_1', status }),
    checklistComplete: jest.fn().mockResolvedValue(checklistComplete),
    transition: jest.fn().mockResolvedValue({ id: 'mail_1', status: 'queued' })
  });

  it('queues approved mail with a complete checklist', async () => {
    const repository = createRepository('approved', true);
    const useCase = new QueueMailUseCase(repository as any);

    await expect(useCase.execute('mail_1')).resolves.toEqual({ id: 'mail_1', status: 'queued' });
    expect(repository.transition).toHaveBeenCalledWith('mail_1', 'queued', 'queued');
  });

  it('does not queue mail before approval', async () => {
    const repository = createRepository('draft', true);
    const useCase = new QueueMailUseCase(repository as any);

    await expect(useCase.execute('mail_1')).rejects.toThrow(ConflictException);
    expect(repository.transition).not.toHaveBeenCalled();
  });

  it('does not queue mail with an incomplete checklist', async () => {
    const repository = createRepository('approved', false);
    const useCase = new QueueMailUseCase(repository as any);

    await expect(useCase.execute('mail_1')).rejects.toThrow(ConflictException);
    expect(repository.transition).not.toHaveBeenCalled();
  });
});
