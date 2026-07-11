import { LeadPriority, LeadStatus } from '@prisma/client';

const TERMINAL_STATUSES: LeadStatus[] = ['rejected', 'archived'];
const FOLLOW_UP_STATUSES: LeadStatus[] = ['contacted', 'no_response'];

export type LeadPolicyInput = {
  status?: LeadStatus;
  priority?: LeadPriority;
  score?: number;
  nextActionAt?: Date | null;
  nextFollowUpAt?: Date | null;
};

export type LeadPolicyPatch = {
  priority?: LeadPriority;
  nextActionAt?: Date | null;
  nextFollowUpAt?: Date | null;
};

export function applyLeadPolicy(input: LeadPolicyInput, now = new Date()): LeadPolicyPatch {
  const patch: LeadPolicyPatch = {};

  const priority = input.priority ?? priorityForScore(input.score);
  if (priority) {
    patch.priority = priority;
  }

  if (input.status && isTerminalStatus(input.status)) {
    patch.nextActionAt = null;
    patch.nextFollowUpAt = null;
    return patch;
  }

  const nextActionAt = input.nextActionAt ?? defaultNextActionAt(input.status, priority, now);
  if (nextActionAt !== undefined) {
    patch.nextActionAt = nextActionAt;
  }

  const nextFollowUpAt = input.nextFollowUpAt ?? defaultNextFollowUpAt(input.status, now);
  if (nextFollowUpAt !== undefined) {
    patch.nextFollowUpAt = nextFollowUpAt;
  }

  return patch;
}

export function priorityForScore(score?: number): LeadPriority | undefined {
  if (score === undefined) return undefined;
  if (score >= 70) return 'high';
  if (score < 35) return 'low';
  return 'medium';
}

function defaultNextActionAt(status: LeadStatus | undefined, priority: LeadPriority | undefined, now: Date) {
  if (status === 'meeting_candidate' || priority === 'high') return daysFrom(now, 1);
  if (status === 'qualified') return daysFrom(now, 2);
  if (status === 'discovered') return daysFrom(now, 3);
  return undefined;
}

function defaultNextFollowUpAt(status: LeadStatus | undefined, now: Date) {
  if (status && FOLLOW_UP_STATUSES.includes(status)) {
    return daysFrom(now, status === 'contacted' ? 3 : 7);
  }
  return undefined;
}

function isTerminalStatus(status: LeadStatus) {
  return TERMINAL_STATUSES.includes(status);
}

function daysFrom(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}
