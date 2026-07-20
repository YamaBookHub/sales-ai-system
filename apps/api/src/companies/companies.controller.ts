import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ok } from '../common/api-response';
import { BlockCompanyDto, CreateCompanyDto } from './companies.dto';
import { CompaniesService } from './companies.service';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { AuditAction } from '../audit/audit-action.decorator';

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
  @AuditAction('company.created', 'Company', [])
  async create(@Body() dto: CreateCompanyDto) {
    return ok(await this.companies.create(dto));
  }

  @Post(':id/block')
  @RequirePermissions('compliance.manage')
  @AuditAction('company.blocked', 'Company', ['id'])
  async block(@Param('id') id: string, @Body() dto: BlockCompanyDto) {
    return ok(await this.companies.block(id, dto));
  }
}
