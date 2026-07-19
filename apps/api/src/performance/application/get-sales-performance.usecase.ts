import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  buildSalesPerformanceReport,
  resolveSalesPerformancePeriod,
  SalesPerformancePeriodError,
  SalesPerformanceSource
} from '../domain/sales-performance';
import {
  SALES_PERFORMANCE_REPOSITORY,
  SalesPerformanceRepository
} from '../domain/sales-performance.repository';

export type GetSalesPerformanceInput = {
  from?: string;
  to?: string;
  ownerId?: string;
  source?: SalesPerformanceSource;
};

@Injectable()
export class GetSalesPerformanceUseCase {
  constructor(
    @Inject(SALES_PERFORMANCE_REPOSITORY)
    private readonly repository: SalesPerformanceRepository
  ) {}

  async execute(input: GetSalesPerformanceInput, now = new Date()) {
    try {
      const period = resolveSalesPerformancePeriod(input, now);
      const counts = await this.repository.summarize({
        startUtc: period.startUtc,
        endExclusiveUtc: period.endExclusiveUtc,
        ownerId: input.ownerId,
        source: input.source
      });
      return buildSalesPerformanceReport(period, input, counts);
    } catch (error) {
      if (error instanceof SalesPerformancePeriodError) {
        const message = error.code === 'invalid_range'
          ? '開始日は終了日以前の日付を指定してください。'
          : '期間はYYYY-MM-DD形式の正しい日付で指定してください。';
        throw new BadRequestException(message);
      }
      throw error;
    }
  }
}
