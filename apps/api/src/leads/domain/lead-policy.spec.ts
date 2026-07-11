import { applyLeadPolicy, priorityForScore } from './lead-policy';

describe('lead-policy', () => {
  const now = new Date('2026-07-11T00:00:00.000Z');

  it('maps scores to explainable priority bands', () => {
    expect(priorityForScore(80)).toBe('high');
    expect(priorityForScore(45)).toBe('medium');
    expect(priorityForScore(20)).toBe('low');
    expect(priorityForScore()).toBeUndefined();
  });

  it('keeps explicit priority ahead of score-derived priority', () => {
    expect(applyLeadPolicy({ priority: 'medium', score: 90 }, now)).toMatchObject({ priority: 'medium' });
  });

  it('sets near-term action dates for high-intent leads', () => {
    expect(applyLeadPolicy({ status: 'meeting_candidate' }, now).nextActionAt).toEqual(new Date('2026-07-12T00:00:00.000Z'));
    expect(applyLeadPolicy({ score: 75 }, now).nextActionAt).toEqual(new Date('2026-07-12T00:00:00.000Z'));
  });

  it('sets default follow-up dates after outreach', () => {
    expect(applyLeadPolicy({ status: 'contacted' }, now).nextFollowUpAt).toEqual(new Date('2026-07-14T00:00:00.000Z'));
    expect(applyLeadPolicy({ status: 'no_response' }, now).nextFollowUpAt).toEqual(new Date('2026-07-18T00:00:00.000Z'));
  });

  it('clears action dates for terminal statuses', () => {
    expect(applyLeadPolicy({ status: 'archived', nextActionAt: now, nextFollowUpAt: now }, now)).toEqual({
      nextActionAt: null,
      nextFollowUpAt: null
    });
  });
});
