import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ok } from '../common/api-response';
import { BlockCompanyDto, CreateCompanyDto } from './companies.dto';
import { CompaniesService } from './companies.service';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { auditActor } from '../audit/audit-actor';

@Controller('companies')
@RequirePermissions('workspace.read')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  async list(@Query('page') page = '1', @Query('limit') limit = '20') {
    return ok(await this.companies.list(Number(page), Number(limit)));
  }

  @Post()
  @RequirePermissions('records.write')
  async create(@Body() dto: CreateCompanyDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.companies.create(dto, auditActor(principal)));
  }

  @Post(':id/block')
  @RequirePermissions('compliance.manage')
  async block(@Param('id') id: string, @Body() dto: BlockCompanyDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.companies.block(id, dto, auditActor(principal)));
  }
}
