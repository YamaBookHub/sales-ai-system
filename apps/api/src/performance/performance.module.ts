import { Module } from '@nestjs/common';
import { GetSalesPerformanceUseCase } from './application/get-sales-performance.usecase';
import { ListSalesPerformanceOwnersUseCase } from './application/list-sales-performance-owners.usecase';
import { SALES_PERFORMANCE_REPOSITORY } from './domain/sales-performance.repository';
import { PrismaSalesPerformanceRepository } from './infrastructure/prisma-sales-performance.repository';
import { SalesPerformanceController } from './sales-performance.controller';

@Module({
  controllers: [SalesPerformanceController],
  providers: [
    PrismaSalesPerformanceRepository,
    {
      provide: SALES_PERFORMANCE_REPOSITORY,
      useExisting: PrismaSalesPerformanceRepository
    },
    GetSalesPerformanceUseCase,
    ListSalesPerformanceOwnersUseCase
  ]
})
export class PerformanceModule {}
