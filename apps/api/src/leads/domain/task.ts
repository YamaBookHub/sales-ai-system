import { LeadStatus, TaskStatus } from '@prisma/client';

export const ACTIVE_TASK_STATUSES: TaskStatus[] = ['todo', 'doing'];
export const TERMINAL_LEAD_STATUSES: LeadStatus[] = ['rejected', 'archived'];

export type TaskAssigneeView = {
  id: string;
  name: string | null;
  email: string;
};

export type TaskView = {
  id: string;
  leadId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueAt: string | null;
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: TaskAssigneeView | null;
};

export type TaskRecord = {
  id: string;
  leadId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueAt: Date | null;
  doneAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignee: { id: string; name: string | null; email: string } | null;
};

export type LeadNextTaskSummary = {
  nextTask: TaskView | null;
  activeTaskCount: number;
};

export function toTaskView(record: TaskRecord): TaskView {
  return {
    id: record.id,
    leadId: record.leadId || '',
    title: record.title,
    description: record.description || null,
    status: record.status,
    dueAt: toNullableIso(record.dueAt),
    doneAt: toNullableIso(record.doneAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    assignee: record.assignee
      ? { id: record.assignee.id, name: record.assignee.name || null, email: record.assignee.email }
      : null
  };
}

export function isActiveTaskStatus(status: TaskStatus) {
  return ACTIVE_TASK_STATUSES.includes(status);
}

export function canCreateTaskForLead(status: LeadStatus) {
  return !TERMINAL_LEAD_STATUSES.includes(status);
}

function toNullableIso(value: Date | null) {
  return value ? value.toISOString() : null;
}
