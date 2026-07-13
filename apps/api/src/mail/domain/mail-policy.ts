import { ConflictException } from '@nestjs/common';
import { EmailStatus, LeadStatus } from '@prisma/client';

export function assertCanRequestReReview(status: EmailStatus) {
  if (status !== 'rejected') {
    throw new ConflictException('Only rejected mail can be requested for re-review.');
  }
}

export function assertCanReject(status: EmailStatus) {
  if (!['in_review', 'approved'].includes(status)) {
    throw new ConflictException('Only in_review or approved mail can be rejected.');
  }
}

export function assertCanQueue(status: EmailStatus, checklistComplete: boolean) {
  if (status !== 'approved') {
    throw new ConflictException('Only approved mail can be queued.');
  }

  assertChecklistComplete(checklistComplete);
}

export function assertCanMarkSent(status: EmailStatus) {
  if (!['approved', 'queued', 'sending'].includes(status)) {
    throw new ConflictException('承認済み、送信待ち、または送信結果を確認済みのメールだけ送信済みにできます。');
  }
}

export function assertCanSendQueued(status: EmailStatus, checklistComplete: boolean) {
  if (status !== 'queued') {
    throw new ConflictException('送信待ちのメールだけ実送信できます。');
  }

  assertChecklistComplete(checklistComplete);
}

export function assertCanRetry(status: EmailStatus) {
  if (status !== 'failed') {
    throw new ConflictException('Only failed mail can be retried.');
  }
}

export function assertChecklistComplete(complete: boolean) {
  if (!complete) {
    throw new ConflictException('送信前チェックリストが未完了です。全項目を確認してから承認してください。');
  }
}

export function leadStatusForEmailStatus(status: EmailStatus): LeadStatus | null {
  if (status === 'draft') return 'drafted';
  if (status === 'in_review') return 'reviewing';
  if (status === 'rejected') return 'rejected';
  if (status === 'approved') return 'approved';
  if (status === 'queued') return 'queued';
  if (status === 'sent') return 'contacted';
  return null;
}
