import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { ok } from '../common/api-response';
import { BulkImportProjectsUseCase } from './application/bulk-import-projects.usecase';
import { ImportProjectUseCase } from './application/import-project.usecase';
import { SearchProjectsUseCase } from './application/search-projects.usecase';
import { BulkImportProjectsDto, CreateProjectDto, ImportCampfireProjectDto, ImportProjectDto, SearchCampfireProjectsDto, SearchProjectsDto } from './projects.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly searchUseCase: SearchProjectsUseCase,
    private readonly importProjects: ImportProjectUseCase,
    private readonly bulkImportProjects: BulkImportProjectsUseCase
  ) {}

  @Get()
  async list(@Query('page') page = '1', @Query('limit') limit = '20', @Query('status') status?: ProjectStatus) {
    return ok(await this.projects.list(Number(page), Number(limit), status));
  }

  @Post()
  async create(@Body() dto: CreateProjectDto) {
    return ok(await this.projects.create(dto));
  }

  @Post('import/campfire')
  async importCampfire(@Body() dto: ImportCampfireProjectDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.importProjects.importCampfire(dto, principal.userId));
  }

  @Post('import')
  async importProject(@Body() dto: ImportProjectDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.importProjects.import(dto, principal.userId));
  }

  @Post('bulk-import')
  async bulkImport(@Body() dto: BulkImportProjectsDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.bulkImportProjects.execute(dto, principal.userId));
  }

  @Get('categories/campfire')
  async campfireCategories() {
    return ok(await this.projects.campfireCategories());
  }

  @Get('categories')
  async categories(@Query('source') source = 'campfire') {
    return ok(await this.projects.categories(source));
  }

  @Post('search/campfire')
  async searchCampfire(@Body() dto: SearchCampfireProjectsDto) {
    return ok(await this.searchUseCase.searchCampfire(dto));
  }

  @Post('search')
  async searchProjects(@Body() dto: SearchProjectsDto) {
    return ok(await this.searchUseCase.search(dto));
  }

  @Post('search-jobs')
  async startSearchJob(@Body() dto: SearchProjectsDto) {
    return ok(this.searchUseCase.startJob(dto));
  }

  @Get('search-jobs/:id')
  async getSearchJob(@Param('id') id: string) {
    return ok(this.searchUseCase.getJob(id));
  }

  @Post('search-jobs/:id/cancel')
  async cancelSearchJob(@Param('id') id: string) {
    return ok(this.searchUseCase.cancelJob(id));
  }
}
