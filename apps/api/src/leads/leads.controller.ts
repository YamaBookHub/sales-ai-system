import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../common/api-response';
import { CreateLeadDto, ListLeadsQueryDto, UpdateLeadDto } from './leads.dto';
import { LeadsService } from './leads.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { AuditAction } from '../audit/audit-action.decorator';

@Controller('leads')
@RequirePermissions('workspace.read')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  async list(@Query() query: ListLeadsQueryDto) {
    return ok(await this.leads.list(query.page, query.limit, query.status, query.priority, query));
  }

  @Get('today')
  async listToday(@Query('page') page = '1', @Query('limit') limit = '50') {
    return ok(await this.leads.listToday(Number(page), Number(limit)));
  }

  @Post()
  @RequirePermissions('records.write')
  @AuditAction('lead.created', 'SalesLead', [])
  async create(@Body() dto: CreateLeadDto) {
    return ok(await this.leads.create(dto));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return ok(await this.leads.get(id));
  }

  @Patch(':id')
  @RequirePermissions('records.write')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() principal: AuthenticatedPrincipal
  ) {
    return ok(await this.leads.update(id, dto, principal.userId));
  }

  @Post(':id/score')
  @RequirePermissions('records.write')
  @AuditAction('lead.scored', 'SalesLead', ['id'])
  async score(@Param('id') id: string) {
    return ok(await this.leads.score(id));
  }
}
