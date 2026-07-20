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
import { AuditActor } from '../../audit/audit-actor';

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

  async create(input: CreateTaskRecord, actor?: AuditActor): Promise<TaskView> {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          leadId: input.leadId,
          title: input.title,
          description: input.description,
          dueAt: input.dueAt,
          assigneeId: input.assigneeId
        },
        include: taskInclude
      });
      if (actor) {
        await tx.auditLog.create({
          data: {
            ...actor,
            action: 'task.created',
            entityType: 'Task',
            entityId: task.id,
            after: { taskId: task.id, leadId: task.leadId, assigneeId: task.assigneeId, status: task.status }
          }
        });
      }
      return toTaskView(task as TaskRecord);
    });
  }

  async update(id: string, input: UpdateTaskRecord, actor?: AuditActor): Promise<TaskView> {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.update({ where: { id }, data: input, include: taskInclude });
      if (actor) {
        await tx.auditLog.create({
          data: {
            ...actor,
            action: 'task.updated',
            entityType: 'Task',
            entityId: task.id,
            after: {
              taskId: task.id,
              leadId: task.leadId,
              assigneeId: task.assigneeId,
              status: task.status,
              changedFields: Object.keys(input).sort()
            }
          }
        });
      }
      return toTaskView(task as TaskRecord);
    });
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
