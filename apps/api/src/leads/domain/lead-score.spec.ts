import { calculateLeadScore } from './lead-score';

describe('lead-score', () => {
  it('calculates the MVP score from project traction and fit', () => {
    const score = calculateLeadScore({
      projectAmount: 3_500_000,
      supporterCount: 240,
      category: '食品',
      endDate: new Date('2026-07-20T00:00:00.000Z')
    });

    expect(score.amountScore).toBe(15);
    expect(score.supporterScore).toBe(10);
    expect(score.fitScore).toBe(20);
    expect(score.urgencyScore).toBe(10);
    expect(score.activityScore).toBe(10);
    expect(score.totalScore).toBe(65);
    expect(score.reasonJson).toMatchObject({ projectAmount: 3_500_000, supporterCount: 240 });
  });

  it('uses conservative defaults when project details are missing', () => {
    expect(calculateLeadScore({}).totalScore).toBe(25);
  });

  it('caps traction score so very large projects do not dominate everything', () => {
    const score = calculateLeadScore({
      projectAmount: 100_000_000,
      supporterCount: 10_000,
      category: 'ガジェット',
      endDate: new Date('2026-07-20T00:00:00.000Z')
    });

    expect(score.amountScore).toBe(30);
    expect(score.supporterScore).toBe(25);
    expect(score.totalScore).toBe(95);
  });
});
