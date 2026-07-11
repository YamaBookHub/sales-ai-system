import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CampfireScraperService } from '../scraper/campfire-scraper.service';
import { BulkImportProjectsUseCase } from './application/bulk-import-projects.usecase';
import { ImportProjectUseCase } from './application/import-project.usecase';
import { ProjectSearchJobManager } from './application/project-search-job.manager';
import { SearchProjectsUseCase } from './application/search-projects.usecase';
import { CampfireProjectSourceProvider } from './infrastructure/campfire-project-source.provider';
import { MakuakeProjectSourceProvider } from './infrastructure/makuake-project-source.provider';
import { PrismaProjectImportRepository } from './infrastructure/prisma-project-import.repository';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AiModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    SearchProjectsUseCase,
    ImportProjectUseCase,
    BulkImportProjectsUseCase,
    ProjectSearchJobManager,
    CampfireScraperService,
    PrismaProjectImportRepository,
    CampfireProjectSourceProvider,
    MakuakeProjectSourceProvider
  ]
})
export class ProjectsModule {}
