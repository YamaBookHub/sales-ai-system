import { PrismaService } from '../../prisma/prisma.service';
import { PrismaTaskRepository } from './prisma-task.repository';

describe('PrismaTaskRepository', () => {
  function taskRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: 'task_1',
      leadId: 'lead_1',
      title: '確認する',
      description: null,
      status: 'todo',
      dueAt: new Date('2026-07-13T00:00:00.000Z'),
      doneAt: null,
      createdAt: new Date('2026-07-12T00:00:00.000Z'),
      updatedAt: new Date('2026-07-12T00:00:00.000Z'),
      assignee: { id: 'user_1', name: '担当者', email: 'owner@example.com' },
      ...overrides
    };
  }

  it('queries only active statuses by default and maps the assignee', async () => {
    const prisma = {
      task: { findMany: jest.fn().mockResolvedValue([taskRecord()]) }
    } as unknown as PrismaService;
    const repository = new PrismaTaskRepository(prisma);

    const result = await repository.listByLead('lead_1', 'active');

    expect((prisma.task.findMany as jest.Mock).mock.calls[0][0]).toEqual(expect.objectContaining({
      where: { leadId: 'lead_1', status: { in: ['todo', 'doing'] } }
    }));
    expect(result[0]).toMatchObject({ id: 'task_1', leadId: 'lead_1', assignee: { id: 'user_1', name: '担当者' } });
  });

  it('does not add an active status condition for history scope', async () => {
    const prisma = {
      task: { findMany: jest.fn().mockResolvedValue([taskRecord({ status: 'done', dueAt: null })]) }
    } as unknown as PrismaService;
    const repository = new PrismaTaskRepository(prisma);

    await repository.listByLead('lead_1', 'all');

    expect((prisma.task.findMany as jest.Mock).mock.calls[0][0].where).toEqual({ leadId: 'lead_1' });
  });
});
