import { BadRequestException, Injectable } from '@nestjs/common';
import { normalizeEndingSoonDays, normalizeResultLimit, sortEndingSoon } from '../domain/project-import-policy';
import { ProjectSearchOptions, ProjectSourceProvider } from '../domain/project-source-provider';
import { CampfireProjectSourceProvider } from '../infrastructure/campfire-project-source.provider';
import { MakuakeProjectSourceProvider } from '../infrastructure/makuake-project-source.provider';
import { ProjectSource, SearchCampfireProjectsDto, SearchProjectsDto } from '../projects.dto';
import { ProjectSearchJobManager } from './project-search-job.manager';

@Injectable()
export class SearchProjectsUseCase {
  constructor(
    private readonly projectSearchJobManager: ProjectSearchJobManager,
    private readonly campfireProvider: CampfireProjectSourceProvider,
    private readonly makuakeProvider: MakuakeProjectSourceProvider
  ) {}

  search(dto: SearchProjectsDto, organizationId: string) {
    void organizationId;
    return this.searchWithProvider(this.providerFor(dto.source), dto);
  }

  searchCampfire(dto: SearchCampfireProjectsDto, organizationId: string) {
    void organizationId;
    return this.searchWithProvider(this.providerFor('campfire'), dto);
  }

  startJob(dto: SearchProjectsDto, organizationId: string, ownerUserId: string) {
    const provider = this.providerFor(dto.source);
    return this.projectSearchJobManager.start(organizationId, ownerUserId, provider, dto, (searchProvider, searchDto, options) =>
      this.searchWithProvider(searchProvider, searchDto, options)
    );
  }

  getJob(id: string, organizationId: string, ownerUserId: string) {
    return this.projectSearchJobManager.get(id, organizationId, ownerUserId);
  }

  cancelJob(id: string, organizationId: string, ownerUserId: string) {
    return this.projectSearchJobManager.cancel(id, organizationId, ownerUserId);
  }

  private async searchWithProvider(provider: ProjectSourceProvider, dto: SearchCampfireProjectsDto, options?: ProjectSearchOptions) {
    const result = await provider.search({ ...dto, excludeUrls: dto.excludeUrls || [] }, options);
    if (dto.status === 'endingSoon') {
      return {
        items: sortEndingSoon(result.items, normalizeEndingSoonDays(dto.endingSoonDays)).slice(0, normalizeResultLimit(dto.limit)),
        diagnostics: result.diagnostics
      };
    }
    return result;
  }

  private providerFor(source?: string): ProjectSourceProvider {
    const normalizedSource = normalizeProjectSource(source);
    if (normalizedSource === 'campfire') return this.campfireProvider;
    if (normalizedSource === 'makuake') return this.makuakeProvider;
    throw unsupportedProjectSource(normalizedSource);
  }
}

function normalizeProjectSource(source?: string): ProjectSource {
  const normalized = (source || 'campfire').trim().toLowerCase().replace('-', '_');
  if (normalized === 'campfire' || normalized === 'makuake' || normalized === 'green_funding') {
    return normalized;
  }
  throw new BadRequestException(`未対応の取得元です: ${source || '未指定'}`);
}

function unsupportedProjectSource(source: ProjectSource) {
  return new BadRequestException(`${sourceLabel(source)}は準備中です。現在はCAMPFIREのみ検索・取り込みできます。`);
}

function sourceLabel(source: ProjectSource) {
  return ({
    campfire: 'CAMPFIRE',
    makuake: 'Makuake',
    green_funding: 'GREEN FUNDING'
  })[source];
}
