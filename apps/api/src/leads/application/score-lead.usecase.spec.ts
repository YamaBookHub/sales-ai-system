import { ScoreLeadUseCase } from './score-lead.usecase';

describe('ScoreLeadUseCase', () => {
  it('calculates score from project data and records lead policy update', async () => {
    const repository = {
      getForScoring: jest.fn().mockResolvedValue({
        id: 'lead_1',
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

    await expect(useCase.execute('lead_1')).resolves.toEqual({ id: 'score_1', totalScore: 65 });
    expect(repository.recordScore).toHaveBeenCalledWith(
      'lead_1',
      expect.objectContaining({
        amountScore: 15,
        supporterScore: 10,
        fitScore: 20,
        urgencyScore: 10,
        totalScore: 65
      }),
      expect.objectContaining({
        priority: 'medium'
      })
    );
  });
});
