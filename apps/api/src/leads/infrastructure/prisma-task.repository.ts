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
  // Taskの担当者は組織メンバーとして紐付く。画面には従来どおりUserの表示名とメールを返す。
  assignee: { select: { user: { select: { id: true, name: true, email: true } } } }
} as const;

@Injectable()
export class PrismaTaskRepository implements TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLead(organizationId: string, id: string): Promise<TaskLead | null> {
    return this.prisma.salesLead.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true, status: true }
    });
  }

  async listByLead(organizationId: string, leadId: string, scope: TaskScope): Promise<TaskView[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        organizationId,
        leadId,
        ...(scope === 'active' ? { status: { in: ACTIVE_TASK_STATUSES } } : {})
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      include: taskInclude
    });
    return tasks.map(toTaskRecord).sort(activeTaskOrder).map(toTaskView);
  }

  async findTask(organizationId: string, id: string): Promise<TaskRecord | null> {
    const task = await this.prisma.task.findFirst({ where: { id, organizationId }, include: taskInclude });
    return task ? toTaskRecord(task) : null;
  }

  async create(input: CreateTaskRecord, actor: AuditActor): Promise<TaskView> {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          organizationId: input.organizationId,
          leadId: input.leadId,
          title: input.title,
          description: input.description,
          dueAt: input.dueAt,
          assigneeId: input.assigneeId
        },
        include: taskInclude
      });
      await tx.auditLog.create({
        data: {
          ...actor,
          action: 'task.created',
          entityType: 'Task',
          entityId: task.id,
          after: { taskId: task.id, leadId: task.leadId, assigneeId: task.assigneeId, status: task.status }
        }
      });
      return toTaskView(toTaskRecord(task));
    });
  }

  async update(organizationId: string, id: string, input: UpdateTaskRecord, actor: AuditActor): Promise<TaskView> {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { organizationId_id: { organizationId, id } },
        data: input,
        include: taskInclude
      });
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
      return toTaskView(toTaskRecord(task));
    });
  }

  async findAssignee(organizationId: string, id: string): Promise<TaskAssignee | null> {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        organizationId,
        userId: id,
        isActive: true,
        user: { isActive: true, deletedAt: null }
      },
      select: { user: { select: { id: true, name: true, email: true } } }
    });
    return membership?.user || null;
  }

  async listAssignees(organizationId: string): Promise<TaskAssignee[]> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId,
        isActive: true,
        user: { isActive: true, deletedAt: null }
      },
      orderBy: [{ user: { name: 'asc' } }, { user: { email: 'asc' } }],
      select: { user: { select: { id: true, name: true, email: true } } }
    });
    return memberships.map((membership) => membership.user);
  }
}

function toTaskRecord(task: {
  id: string;
  leadId: string | null;
  title: string;
  description: string | null;
  status: TaskRecord['status'];
  dueAt: Date | null;
  doneAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignee: { user: TaskAssignee } | TaskAssignee | null;
}): TaskRecord {
  return {
    ...task,
    assignee: task.assignee && 'user' in task.assignee ? task.assignee.user : task.assignee
  };
}
