import { Controller, Get, Query } from '@nestjs/common';
import { ok } from '../common/api-response';
import { GetSalesPerformanceUseCase } from './application/get-sales-performance.usecase';
import { ListSalesPerformanceOwnersUseCase } from './application/list-sales-performance-owners.usecase';
import { GetSalesPerformanceQueryDto } from './sales-performance.dto';

@Controller('reports/sales-performance')
export class SalesPerformanceController {
  constructor(
    private readonly getSalesPerformance: GetSalesPerformanceUseCase,
    private readonly listOwners: ListSalesPerformanceOwnersUseCase
  ) {}

  @Get('owners')
  async owners() {
    return ok(await this.listOwners.execute());
  }

  @Get()
  async get(@Query() query: GetSalesPerformanceQueryDto) {
    return ok(await this.getSalesPerformance.execute(query));
  }
}
