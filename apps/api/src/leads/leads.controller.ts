import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { LeadPriority, LeadStatus } from '@prisma/client';
import { ok } from '../common/api-response';
import { CreateLeadDto, UpdateLeadDto } from './leads.dto';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: LeadStatus,
    @Query('priority') priority?: LeadPriority
  ) {
    return ok(await this.leads.list(Number(page), Number(limit), status, priority));
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
