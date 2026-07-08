import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ok } from '../common/api-response';
import { BlockCompanyDto, CreateCompanyDto } from './companies.dto';
import { CompaniesService } from './companies.service';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  async list(@Query('page') page = '1', @Query('limit') limit = '20') {
    return ok(await this.companies.list(Number(page), Number(limit)));
  }

  @Post()
  async create(@Body() dto: CreateCompanyDto) {
    return ok(await this.companies.create(dto));
  }

  @Post(':id/block')
  async block(@Param('id') id: string, @Body() dto: BlockCompanyDto) {
    return ok(await this.companies.block(id, dto));
  }
}
