import { ScoreLeadUseCase } from './score-lead.usecase';

describe('ScoreLeadUseCase', () => {
  it('calculates score from project data and records lead policy update', async () => {
    const repository = {
      getForScoring: jest.fn().mockResolvedValue({
        id: 'lead_1',
        nextActionAt: new Date('2026-07-18T00:00:00.000Z'),
        nextFollowUpAt: new Date('2026-07-21T00:00:00.000Z'),
        project: {
          amount: 3500000,
          supporterCount: 240,
          category: '食品',
          endDate: new Date('2026-07-20T00:00:00.000Z')
        }
      }),
      recordScore: jest.fn().mockResolvedValue({ id: 'score_1', totalScore: 65 })
    };
    const useCase = new ScoreLeadUseCase(repository as any);

    const actor = { userId: 'user_1', sessionId: 'session_1', organizationId: 'org_1' };
    await expect(useCase.execute('org_1', 'lead_1', actor)).resolves.toEqual({ id: 'score_1', totalScore: 65 });
    expect(repository.recordScore).toHaveBeenCalledWith(
      'org_1',
      'lead_1',
      expect.objectContaining({
        amountScore: 15,
        supporterScore: 10,
        fitScore: 20,
        urgencyScore: 10,
        totalScore: 65
      }),
      'medium',
      actor
    );
  });
});
