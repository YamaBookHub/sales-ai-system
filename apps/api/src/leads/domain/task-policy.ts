import { TaskStatus } from '@prisma/client';

type TaskTransitionSuccess = { ok: true; doneAt: Date | null };
type TaskTransitionFailure = { ok: false; reason: 'invalid_transition' };
export type TaskTransitionResult = TaskTransitionSuccess | TaskTransitionFailure;

const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ['todo', 'doing', 'done', 'cancelled'],
  doing: ['todo', 'doing', 'done', 'cancelled'],
  done: ['done', 'todo'],
  cancelled: ['cancelled', 'todo']
};

export function transitionTaskStatus(
  current: TaskStatus,
  next: TaskStatus,
  existingDoneAt: Date | null,
  now = new Date()
): TaskTransitionResult {
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    return { ok: false, reason: 'invalid_transition' };
  }

  if (next === 'done') {
    return { ok: true, doneAt: existingDoneAt || now };
  }

  return { ok: true, doneAt: null };
}

export function activeTaskOrder(a: { dueAt: Date | null; createdAt: Date }, b: { dueAt: Date | null; createdAt: Date }) {
  if (a.dueAt && !b.dueAt) return -1;
  if (!a.dueAt && b.dueAt) return 1;
  if (a.dueAt && b.dueAt) {
    const dueDifference = a.dueAt.getTime() - b.dueAt.getTime();
    if (dueDifference !== 0) return dueDifference;
  }
  return a.createdAt.getTime() - b.createdAt.getTime();
}
