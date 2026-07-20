import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ok } from '../common/api-response';
import { ListAuditLogsQueryDto } from './audit-query.dto';
import { AuditLogService } from './audit-log.service';

@Controller('admin/audit-logs')
@RequirePermissions('audit.read')
export class AuditController {
  constructor(private readonly audits: AuditLogService) {}

  @Get()
  async list(@Query() query: ListAuditLogsQueryDto) {
    return ok(await this.audits.list(query.page, query.limit, {
      userId: query.userId,
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined
    }));
  }
}
