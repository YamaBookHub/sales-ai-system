import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ok } from '../common/api-response';
import { GetOperationsReportUseCase } from './application/get-operations-report.usecase';
import { GetOperationsReportQueryDto } from './operations-report.dto';

@Controller('reports/operations')
@RequirePermissions('reports.read', 'ai.cost.read')
export class OperationsController {
  constructor(private readonly getOperationsReport: GetOperationsReportUseCase) {}

  @Get()
  async get(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: GetOperationsReportQueryDto) {
    return ok(await this.getOperationsReport.execute({
      organizationId: principal.organizationId,
      from: query.from,
      to: query.to
    }));
  }
}
