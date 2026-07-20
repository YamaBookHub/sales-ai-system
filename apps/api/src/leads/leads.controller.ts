import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../common/api-response';
import { CreateLeadDto, ListLeadsQueryDto, UpdateLeadDto } from './leads.dto';
import { LeadsService } from './leads.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { auditActor } from '../audit/audit-actor';

@Controller('leads')
@RequirePermissions('workspace.read')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  async list(@Query() query: ListLeadsQueryDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.leads.list(principal.organizationId, query.page, query.limit, query.status, query.priority, query));
  }

  @Get('today')
  async listToday(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @CurrentUser() principal: AuthenticatedPrincipal
  ) {
    return ok(await this.leads.listToday(principal.organizationId, Number(page), Number(limit)));
  }

  @Post()
  @RequirePermissions('records.write')
  async create(@Body() dto: CreateLeadDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.leads.create(dto, auditActor(principal)));
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.leads.get(principal.organizationId, id));
  }

  @Patch(':id')
  @RequirePermissions('records.write')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() principal: AuthenticatedPrincipal
  ) {
    return ok(await this.leads.update(id, dto, auditActor(principal)));
  }

  @Post(':id/score')
  @RequirePermissions('records.write')
  async score(@Param('id') id: string, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.leads.score(id, auditActor(principal)));
  }
}
