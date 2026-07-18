import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../common/api-response';
import { CreateLeadDto, ListLeadsQueryDto, UpdateLeadDto } from './leads.dto';
import { LeadsService } from './leads.service';

@Controller('leads')
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
  async create(@Body() dto: CreateLeadDto) {
    return ok(await this.leads.create(dto));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return ok(await this.leads.get(id));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return ok(await this.leads.update(id, dto));
  }

  @Post(':id/score')
  async score(@Param('id') id: string) {
    return ok(await this.leads.score(id));
  }
}
