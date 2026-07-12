import { ConflictException } from '@nestjs/common';
import { TaskRepository } from '../domain/task.repository';
import { UpdateTaskUseCase } from './update-task.usecase';

describe('UpdateTaskUseCase', () => {
  it('sets doneAt when moving a task to done', async () => {
    const repository = {
      findTask: jest.fn().mockResolvedValue({
        id: 'task_1',
        leadId: 'lead_1',
        title: '確認',
        description: null,
        status: 'doing',
        dueAt: null,
        doneAt: null,
        createdAt: new Date('2026-07-12T00:00:00.000Z'),
        updatedAt: new Date('2026-07-12T00:00:00.000Z'),
        assignee: null
      }),
      update: jest.fn().mockResolvedValue({ id: 'task_1' })
    } as unknown as TaskRepository;
    const useCase = new UpdateTaskUseCase(repository);

    await useCase.execute('task_1', { status: 'done' });

    const updateCall = (repository.update as jest.Mock).mock.calls[0];
    expect(updateCall[0]).toBe('task_1');
    expect(updateCall[1].status).toBe('done');
    expect(updateCall[1].doneAt).toBeInstanceOf(Date);
  });

  it('rejects reopening directly into doing', async () => {
    const repository = {
      findTask: jest.fn().mockResolvedValue({
        id: 'task_1',
        leadId: 'lead_1',
        title: '確認',
        description: null,
        status: 'done',
        dueAt: null,
        doneAt: new Date('2026-07-12T00:00:00.000Z'),
        createdAt: new Date('2026-07-12T00:00:00.000Z'),
        updatedAt: new Date('2026-07-12T00:00:00.000Z'),
        assignee: null
      }),
      update: jest.fn()
    } as unknown as TaskRepository;
    const useCase = new UpdateTaskUseCase(repository);

    await expect(useCase.execute('task_1', { status: 'doing' })).rejects.toBeInstanceOf(ConflictException);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
