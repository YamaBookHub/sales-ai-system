import { BadRequestException } from '@nestjs/common';
import { GetSalesPerformanceUseCase } from './get-sales-performance.usecase';
import { SalesPerformanceRepository } from '../domain/sales-performance.repository';

describe('GetSalesPerformanceUseCase', () => {
  const repository: jest.Mocked<SalesPerformanceRepository> = {
    summarize: jest.fn(),
    listOwners: jest.fn()
  };
  const usecase = new GetSalesPerformanceUseCase(repository);

  beforeEach(() => jest.clearAllMocks());

  it('passes one fixed database range and filters to the repository', async () => {
    repository.summarize.mockResolvedValue({
      sentMessages: 2,
      contactedLeads: 2,
      repliedLeads: 1,
      meetingLeads: 1,
      wonLeads: 0,
      lostLeads: 0,
      lossReasonCounts: {}
    });

    const result = await usecase.execute({
      from: '2026-07-01',
      to: '2026-07-31',
      ownerId: '11111111-1111-4111-8111-111111111111',
      source: 'makuake'
    }, new Date('2026-08-01T00:00:00.000Z'));

    expect(repository.summarize).toHaveBeenCalledWith({
      startUtc: new Date('2026-06-30T15:00:00.000Z'),
      endExclusiveUtc: new Date('2026-07-31T15:00:00.000Z'),
      ownerId: '11111111-1111-4111-8111-111111111111',
      source: 'makuake'
    });
    expect(result.counts.contactedLeads).toBe(2);
    expect(result.rates.replyRate).toBe(50);
  });

  it('returns a Japanese validation error before accessing the database', async () => {
    await expect(usecase.execute({ from: '2026-07-02', to: '2026-07-01' }))
      .rejects.toThrow(BadRequestException);
    expect(repository.summarize).not.toHaveBeenCalled();
  });
});
