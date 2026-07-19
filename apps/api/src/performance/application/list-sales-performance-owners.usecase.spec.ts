import { SalesPerformanceRepository } from '../domain/sales-performance.repository';
import { ListSalesPerformanceOwnersUseCase } from './list-sales-performance-owners.usecase';

describe('ListSalesPerformanceOwnersUseCase', () => {
  it('returns active and historical owners supplied by the repository', async () => {
    const ownerItems = [
      { id: 'user_1', name: '現担当者', email: 'active@example.com', isActive: true },
      { id: 'user_2', name: '過去担当者', email: 'former@example.com', isActive: false }
    ];
    const repository: jest.Mocked<SalesPerformanceRepository> = {
      summarize: jest.fn(),
      listOwners: jest.fn().mockResolvedValue(ownerItems)
    };
    const usecase = new ListSalesPerformanceOwnersUseCase(repository);

    await expect(usecase.execute()).resolves.toEqual(ownerItems);
  });
});
