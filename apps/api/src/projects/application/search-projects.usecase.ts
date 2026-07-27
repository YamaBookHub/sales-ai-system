import { Injectable } from '@nestjs/common';
import { normalizeEndingSoonDays, normalizeResultLimit, sortEndingSoon } from '../domain/project-import-policy';
import { ProjectSearchCriteria, ProjectSearchOptions, ProjectSourceProvider, ProjectSourceSearchError } from '../domain/project-source-provider';
import { ProjectSourceRegistry } from '../domain/project-source-registry';
import { SearchCampfireProjectsDto, SearchProjectsDto } from '../projects.dto';
import { ProjectSearchJobManager } from './project-search-job.manager';
import { StructuredLogger } from '../../common/logging/structured-logger.service';

@Injectable()
export class SearchProjectsUseCase {
  constructor(
    private readonly projectSearchJobManager: ProjectSearchJobManager,
    private readonly sourceRegistry: ProjectSourceRegistry,
    private readonly logger: StructuredLogger
  ) {}

  search(dto: SearchProjectsDto, organizationId: string) {
    return this.searchWithProvider(this.sourceRegistry.get(dto.source), dto, organizationId);
  }

  searchCampfire(dto: SearchCampfireProjectsDto, organizationId: string) {
    return this.searchWithProvider(this.sourceRegistry.get('campfire'), dto, organizationId);
  }

  startJob(dto: SearchProjectsDto, organizationId: string, ownerUserId: string) {
    const provider = this.sourceRegistry.get(dto.source);
    return this.projectSearchJobManager.start(organizationId, ownerUserId, provider, dto, (searchProvider, searchDto, options) =>
      this.searchWithProvider(searchProvider, searchDto, organizationId, options, false)
    );
  }

  getJob(id: string, organizationId: string, ownerUserId: string) {
    return this.projectSearchJobManager.get(id, organizationId, ownerUserId);
  }

  cancelJob(id: string, organizationId: string, ownerUserId: string) {
    return this.projectSearchJobManager.cancel(id, organizationId, ownerUserId);
  }

  private async searchWithProvider(
    provider: ProjectSourceProvider,
    dto: ProjectSearchCriteria,
    organizationId: string,
    options?: ProjectSearchOptions,
    logFailure = true
  ) {
    let result: Awaited<ReturnType<ProjectSourceProvider['search']>>;
    try {
      result = await provider.search({ ...dto, excludeUrls: dto.excludeUrls || [] }, options);
    } catch (error) {
      if (logFailure) {
        this.logger.errorEvent('scraper.search_failed', {
          organizationId,
          entityType: 'CrowdfundingProject',
          operation: 'search',
          source: provider.source,
          error
        });
        throw error;
      }
      throw new ProjectSourceSearchError(error);
    }
    if (dto.status === 'endingSoon') {
      return {
        items: sortEndingSoon(result.items, normalizeEndingSoonDays(dto.endingSoonDays)).slice(0, normalizeResultLimit(dto.limit)),
        diagnostics: result.diagnostics
      };
    }
    return result;
  }

}
