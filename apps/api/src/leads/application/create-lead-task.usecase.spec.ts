import { ConflictException } from '@nestjs/common';
import { TaskRepository } from '../domain/task.repository';
import { CreateLeadTaskUseCase } from './create-lead-task.usecase';

describe('CreateLeadTaskUseCase', () => {
  const actor = { userId: 'user_1', sessionId: 'session_1', organizationId: 'org_1' };
  function createRepository() {
    return {
      findLead: jest.fn(),
      findAssignee: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'task_1' })
    } as unknown as TaskRepository;
  }

  it('creates a task with normalized text and an ISO due date', async () => {
    const repository = createRepository();
    repository.findLead = jest.fn().mockResolvedValue({ id: 'lead_1', status: 'replied' });
    repository.findAssignee = jest.fn().mockResolvedValue({ id: 'user_1', name: '担当者', email: 'owner@example.com' });
    const useCase = new CreateLeadTaskUseCase(repository);

    await useCase.execute('lead_1', {
      title: '  資料を送る  ',
      description: '  返信内容を確認  ',
      dueAt: '2026-07-13T00:00:00.000+09:00',
      assigneeId: 'user_1'
    }, actor);

    expect(repository.create).toHaveBeenCalledWith({
      organizationId: 'org_1',
      leadId: 'lead_1',
      title: '資料を送る',
      description: '返信内容を確認',
      dueAt: new Date('2026-07-13T00:00:00.000+09:00'),
      assigneeId: 'user_1'
    }, actor);
  });

  it('rejects task creation for a terminal lead', async () => {
    const repository = createRepository();
    repository.findLead = jest.fn().mockResolvedValue({ id: 'lead_1', status: 'rejected' });
    const useCase = new CreateLeadTaskUseCase(repository);

    await expect(useCase.execute('lead_1', { title: '再連絡' }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
