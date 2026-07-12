import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { activeTaskOrder } from '../domain/task-policy';
import { ACTIVE_TASK_STATUSES, TaskRecord, TaskView, toTaskView } from '../domain/task';
import {
  CreateTaskRecord,
  TaskAssignee,
  TaskLead,
  TaskRepository,
  TaskScope,
  UpdateTaskRecord
} from '../domain/task.repository';

const taskInclude = {
  assignee: { select: { id: true, name: true, email: true } }
} as const;

@Injectable()
export class PrismaTaskRepository implements TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLead(id: string): Promise<TaskLead | null> {
    return this.prisma.salesLead.findUnique({ where: { id }, select: { id: true, status: true } });
  }

  async listByLead(leadId: string, scope: TaskScope): Promise<TaskView[]> {
    const tasks = await this.prisma.task.findMany({
      where: { leadId, ...(scope === 'active' ? { status: { in: ACTIVE_TASK_STATUSES } } : {}) },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      include: taskInclude
    });
    return (tasks as TaskRecord[]).sort(activeTaskOrder).map(toTaskView);
  }

  findTask(id: string): Promise<TaskRecord | null> {
    return this.prisma.task.findUnique({ where: { id }, include: taskInclude }) as Promise<TaskRecord | null>;
  }

  async create(input: CreateTaskRecord): Promise<TaskView> {
    const task = await this.prisma.task.create({
      data: {
        leadId: input.leadId,
        title: input.title,
        description: input.description,
        dueAt: input.dueAt,
        assigneeId: input.assigneeId
      },
      include: taskInclude
    });
    return toTaskView(task as TaskRecord);
  }

  async update(id: string, input: UpdateTaskRecord): Promise<TaskView> {
    const task = await this.prisma.task.update({ where: { id }, data: input, include: taskInclude });
    return toTaskView(task as TaskRecord);
  }

  findAssignee(id: string): Promise<TaskAssignee | null> {
    return this.prisma.user.findFirst({
      where: { id, isActive: true },
      select: { id: true, name: true, email: true }
    });
  }

  listAssignees(): Promise<TaskAssignee[]> {
    return this.prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      select: { id: true, name: true, email: true }
    });
  }
}
