import { activeTaskOrder, transitionTaskStatus } from './task-policy';

describe('task policy', () => {
  it('keeps doneAt only for done tasks and sets it when completing', () => {
    const now = new Date('2026-07-12T01:00:00.000Z');

    expect(transitionTaskStatus('todo', 'done', null, now)).toEqual({ ok: true, doneAt: now });
    expect(transitionTaskStatus('done', 'todo', now, now)).toEqual({ ok: true, doneAt: null });
    expect(transitionTaskStatus('doing', 'doing', null, now)).toEqual({ ok: true, doneAt: null });
  });

  it('rejects reopening directly into doing', () => {
    expect(transitionTaskStatus('done', 'doing', new Date('2026-07-11T00:00:00.000Z'))).toEqual({
      ok: false,
      reason: 'invalid_transition'
    });
  });

  it('orders active tasks by due date, then creation date, with undated tasks last', () => {
    const older = new Date('2026-07-12T00:00:00.000Z');
    const later = new Date('2026-07-13T00:00:00.000Z');
    expect(activeTaskOrder({ dueAt: later, createdAt: older }, { dueAt: older, createdAt: later })).toBeGreaterThan(0);
    expect(activeTaskOrder({ dueAt: null, createdAt: older }, { dueAt: later, createdAt: later })).toBeGreaterThan(0);
    expect(activeTaskOrder({ dueAt: older, createdAt: later }, { dueAt: older, createdAt: older })).toBeGreaterThan(0);
  });
});
