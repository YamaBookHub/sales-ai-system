import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { ok } from '../common/api-response';
import { CreateProjectDto, ImportCampfireProjectDto } from './projects.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  async list(@Query('page') page = '1', @Query('limit') limit = '20', @Query('status') status?: ProjectStatus) {
    return ok(await this.projects.list(Number(page), Number(limit), status));
  }

  @Post()
  async create(@Body() dto: CreateProjectDto) {
    return ok(await this.projects.create(dto));
  }

  @Post('import/campfire')
  async importCampfire(@Body() dto: ImportCampfireProjectDto) {
    return ok(await this.projects.importCampfire(dto));
  }
}
