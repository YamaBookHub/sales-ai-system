import { Controller, Get, Query } from '@nestjs/common';
import { ok } from '../common/api-response';
import { GetSalesPerformanceUseCase } from './application/get-sales-performance.usecase';
import { ListSalesPerformanceOwnersUseCase } from './application/list-sales-performance-owners.usecase';
import { GetSalesPerformanceQueryDto } from './sales-performance.dto';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedPrincipal } from '../auth/auth.types';

@Controller('reports/sales-performance')
@RequirePermissions('reports.read')
export class SalesPerformanceController {
  constructor(
    private readonly getSalesPerformance: GetSalesPerformanceUseCase,
    private readonly listOwners: ListSalesPerformanceOwnersUseCase
  ) {}

  @Get('owners')
  async owners(@CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.listOwners.execute(principal.organizationId));
  }

  @Get()
  async get(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: GetSalesPerformanceQueryDto) {
    return ok(await this.getSalesPerformance.execute({ ...query, organizationId: principal.organizationId }));
  }
}
