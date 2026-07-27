import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuditModule } from '../audit/audit.module';
import { CampfireScraperService } from '../scraper/campfire-scraper.service';
import { BulkImportProjectsUseCase } from './application/bulk-import-projects.usecase';
import { ImportProjectUseCase } from './application/import-project.usecase';
import { ProjectSearchJobManager } from './application/project-search-job.manager';
import { ProjectSearchJobRepository } from './domain/project-search-job';
import { SearchProjectsUseCase } from './application/search-projects.usecase';
import { CampfireProjectSourceProvider } from './infrastructure/campfire-project-source.provider';
import { MakuakeProjectSourceProvider } from './infrastructure/makuake-project-source.provider';
import { GreenFundingProjectSourceProvider } from './infrastructure/green-funding-project-source.provider';
import { PrismaProjectImportRepository } from './infrastructure/prisma-project-import.repository';
import { PrismaProjectSearchJobRepository } from './infrastructure/prisma-project-search-job.repository';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectOperationsAuditService } from './application/project-operations-audit.service';
import { PROJECT_SOURCE_PROVIDERS, ProjectSourceRegistry } from './domain/project-source-registry';
import type { ProjectSourceProvider } from './domain/project-source-provider';

const PROJECT_SOURCE_PROVIDER_TYPES = [
  CampfireProjectSourceProvider,
  MakuakeProjectSourceProvider,
  GreenFundingProjectSourceProvider
] as const;

@Module({
  imports: [AiModule, AuditModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    SearchProjectsUseCase,
    ImportProjectUseCase,
    BulkImportProjectsUseCase,
    ProjectOperationsAuditService,
    ProjectSearchJobManager,
    CampfireScraperService,
    PrismaProjectImportRepository,
    PrismaProjectSearchJobRepository,
    { provide: ProjectSearchJobRepository, useExisting: PrismaProjectSearchJobRepository },
    ...PROJECT_SOURCE_PROVIDER_TYPES,
    {
      provide: PROJECT_SOURCE_PROVIDERS,
      inject: [...PROJECT_SOURCE_PROVIDER_TYPES],
      useFactory: (...providers: ProjectSourceProvider[]) => providers
    },
    ProjectSourceRegistry
  ]
})
export class ProjectsModule {}
