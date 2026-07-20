import { LeadStatus, TaskStatus } from '@prisma/client';
import { TaskRecord, TaskView } from './task';
import { AuditActor } from '../../audit/audit-actor';

export const TASK_REPOSITORY = Symbol('TASK_REPOSITORY');
export type TaskScope = 'active' | 'all';

export type TaskLead = { id: string; status: LeadStatus };
export type TaskAssignee = { id: string; name: string | null; email: string };
export type CreateTaskRecord = {
  organizationId: string;
  leadId: string;
  title: string;
  description?: string;
  dueAt?: Date;
  assigneeId?: string;
};
export type UpdateTaskRecord = {
  title?: string;
  description?: string | null;
  dueAt?: Date | null;
  assigneeId?: string | null;
  status?: TaskStatus;
  doneAt?: Date | null;
};

export interface TaskRepository {
  findLead(organizationId: string, id: string): Promise<TaskLead | null>;
  listByLead(organizationId: string, leadId: string, scope: TaskScope): Promise<TaskView[]>;
  findTask(organizationId: string, id: string): Promise<TaskRecord | null>;
  create(input: CreateTaskRecord, actor: AuditActor): Promise<TaskView>;
  update(organizationId: string, id: string, input: UpdateTaskRecord, actor: AuditActor): Promise<TaskView>;
  findAssignee(organizationId: string, id: string): Promise<TaskAssignee | null>;
  listAssignees(organizationId: string): Promise<TaskAssignee[]>;
}
