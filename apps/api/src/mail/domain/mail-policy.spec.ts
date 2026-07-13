import { ConflictException } from '@nestjs/common';
import {
  assertCanMarkSent,
  assertCanQueue,
  assertCanReject,
  assertCanRequestReReview,
  assertCanRetry,
  assertChecklistComplete,
  leadStatusForEmailStatus
} from './mail-policy';

describe('mail-policy', () => {
  it('blocks queue before approval', () => {
    expect(() => assertCanQueue('draft', true)).toThrow(ConflictException);
  });

  it('blocks queue when checklist is incomplete', () => {
    expect(() => assertCanQueue('approved', false)).toThrow(ConflictException);
  });

  it('allows queue only after approval with a complete checklist', () => {
    expect(() => assertCanQueue('approved', true)).not.toThrow();
  });

  it('allows re-review only from rejected', () => {
    expect(() => assertCanRequestReReview('in_review')).toThrow(ConflictException);
    expect(() => assertCanRequestReReview('rejected')).not.toThrow();
  });

  it('allows reject only while in review or approved', () => {
    expect(() => assertCanReject('draft')).toThrow(ConflictException);
    expect(() => assertCanReject('in_review')).not.toThrow();
    expect(() => assertCanReject('approved')).not.toThrow();
  });

  it('allows mark sent after approval, queue, or a manually verified sending state', () => {
    expect(() => assertCanMarkSent('draft')).toThrow(ConflictException);
    expect(() => assertCanMarkSent('approved')).not.toThrow();
    expect(() => assertCanMarkSent('queued')).not.toThrow();
    expect(() => assertCanMarkSent('sending')).not.toThrow();
  });

  it('allows retry only from failed', () => {
    expect(() => assertCanRetry('draft')).toThrow(ConflictException);
    expect(() => assertCanRetry('failed')).not.toThrow();
  });

  it('blocks incomplete checklist', () => {
    expect(() => assertChecklistComplete(false)).toThrow(ConflictException);
    expect(() => assertChecklistComplete(true)).not.toThrow();
  });

  it('maps email status to lead status', () => {
    expect(leadStatusForEmailStatus('draft')).toBe('drafted');
    expect(leadStatusForEmailStatus('in_review')).toBe('reviewing');
    expect(leadStatusForEmailStatus('approved')).toBe('approved');
    expect(leadStatusForEmailStatus('queued')).toBe('queued');
    expect(leadStatusForEmailStatus('sent')).toBe('contacted');
    expect(leadStatusForEmailStatus('cancelled')).toBeNull();
  });
});
