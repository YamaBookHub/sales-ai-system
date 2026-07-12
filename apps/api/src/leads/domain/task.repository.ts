import { LeadStatus, TaskStatus } from '@prisma/client';
import { TaskRecord, TaskView } from './task';

export const TASK_REPOSITORY = Symbol('TASK_REPOSITORY');
export type TaskScope = 'active' | 'all';

export type TaskLead = { id: string; status: LeadStatus };
export type TaskAssignee = { id: string; name: string | null; email: string };
export type CreateTaskRecord = {
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
  findLead(id: string): Promise<TaskLead | null>;
  listByLead(leadId: string, scope: TaskScope): Promise<TaskView[]>;
  findTask(id: string): Promise<TaskRecord | null>;
  create(input: CreateTaskRecord): Promise<TaskView>;
  update(id: string, input: UpdateTaskRecord): Promise<TaskView>;
  findAssignee(id: string): Promise<TaskAssignee | null>;
  listAssignees(): Promise<TaskAssignee[]>;
}
