import { classifyTodaySales, tokyoDateKey } from './today-sales';

describe('today-sales', () => {
  it('classifies overdue and due-today dates at the Tokyo boundary', () => {
    const beforeTokyoMidnight = new Date('2026-07-11T14:59:59.000Z');
    const afterTokyoMidnight = new Date('2026-07-11T15:00:00.000Z');
    const dueAtTokyoMidnight = '2026-07-11T15:00:00.000Z';

    expect(tokyoDateKey(beforeTokyoMidnight)).toBe('2026-07-11');
    expect(tokyoDateKey(afterTokyoMidnight)).toBe('2026-07-12');
    expect(classifyTodaySales({ nextActionAt: dueAtTokyoMidnight }, beforeTokyoMidnight)).toBeNull();
    expect(classifyTodaySales({ nextActionAt: dueAtTokyoMidnight }, afterTokyoMidnight)).toBe('due_today');
    expect(classifyTodaySales({ nextActionAt: '2026-07-10T15:00:00.000Z' }, afterTokyoMidnight)).toBe('overdue');
  });

  it('prefers the explicit next action date over follow-up date', () => {
    const now = new Date('2026-07-12T03:00:00.000Z');
    expect(classifyTodaySales({
      nextActionAt: '2026-07-14T00:00:00.000Z',
      nextFollowUpAt: '2026-07-11T00:00:00.000Z'
    }, now)).toBeNull();
  });

  it('classifies the existing mail and reply signals without scoring', () => {
    const now = new Date('2026-07-12T03:00:00.000Z');
    expect(classifyTodaySales({ mailStatus: 'draft' }, now)).toBe('draft_review');
    expect(classifyTodaySales({ mailStatus: 'approved' }, now)).toBe('approval_pending');
    expect(classifyTodaySales({ mailStatus: 'queued' }, now)).toBe('send_queue');
    expect(classifyTodaySales({ hasReply: true, mailStatus: 'sent' }, now)).toBe('reply_received');
    expect(classifyTodaySales({ mailStatus: 'failed' }, now)).toBe('send_failed');
    expect(classifyTodaySales({}, now)).toBeNull();
  });
});
