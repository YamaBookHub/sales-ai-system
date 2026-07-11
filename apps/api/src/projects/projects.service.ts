import { BadRequestException, Injectable } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { runWithConcurrency } from '../common/concurrency';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectSearchJobManager } from './application/project-search-job.manager';
import { ProjectActor } from './domain/project-actor';
import {
  buildBulkImportSummary,
  BulkImportAnalysisResult,
  BulkImportItemResult,
  clampConcurrency,
  normalizeEndingSoonDays,
  normalizeResultLimit,
  sortEndingSoon,
  uniqueNormalizedUrlInputs
} from './domain/project-import-policy';
import { ProjectSourceProvider } from './domain/project-source-provider';
import { CampfireProjectSourceProvider } from './infrastructure/campfire-project-source.provider';
import { MakuakeProjectSourceProvider } from './infrastructure/makuake-project-source.provider';
import { PrismaProjectImportRepository } from './infrastructure/prisma-project-import.repository';
import { BulkImportProjectsDto, CreateProjectDto, ImportCampfireProjectDto, ImportProjectDto, ProjectSource, SearchCampfireProjectsDto, SearchProjectsDto } from './projects.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly projectSearchJobManager: ProjectSearchJobManager,
    private readonly projectImportRepository: PrismaProjectImportRepository,
    private readonly campfireProvider: CampfireProjectSourceProvider,
    private readonly makuakeProvider: MakuakeProjectSourceProvider
  ) {}

  async list(page = 1, limit = 20, status?: ProjectStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.crowdfundingProject.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.crowdfundingProject.count({ where })
    ]);

    return { items, page, limit, total };
  }

  create(dto: CreateProjectDto) {
    return this.prisma.crowdfundingProject.create({
      data: {
        platformId: dto.platformId,
        companyId: dto.companyId,
        title: dto.title,
        url: dto.url,
        status: dto.status ?? 'unknown',
        amount: dto.amount ?? 0,
        supporterCount: dto.supporterCount ?? 0,
        category: dto.category
      }
    });
  }

  searchProjects(dto: SearchProjectsDto) {
    const provider = this.providerFor(dto.source);
    return this.searchWithProvider(provider, dto);
  }

  async searchCampfire(dto: SearchCampfireProjectsDto) {
    return this.searchWithProvider(this.providerFor('campfire'), dto);
  }

  async searchWithProvider(provider: ProjectSourceProvider, dto: SearchCampfireProjectsDto) {
    const result = await provider.search({ ...dto, excludeUrls: dto.excludeUrls || [] });
    if (dto.status === 'endingSoon') {
      return {
        items: sortEndingSoon(result.items, normalizeEndingSoonDays(dto.endingSoonDays)).slice(0, normalizeResultLimit(dto.limit))
      };
    }
    return result;
  }

  startSearchJob(dto: SearchProjectsDto) {
    const provider = this.providerFor(dto.source);
    return this.projectSearchJobManager.start(provider, dto, (searchProvider, searchDto) => this.searchWithProvider(searchProvider, searchDto));
  }

  getSearchJob(id: string) {
    return this.projectSearchJobManager.get(id);
  }

  cancelSearchJob(id: string) {
    return this.projectSearchJobManager.cancel(id);
  }

  campfireCategories() {
    return this.providerFor('campfire').categories();
  }

  categories(source = 'campfire') {
    return this.providerFor(source).categories();
  }

  importProject(dto: ImportProjectDto, actor: ProjectActor = {}) {
    return this.importWithProvider(this.providerFor(dto.source), dto.url, { actor });
  }

  async importCampfire(dto: ImportCampfireProjectDto, actor: ProjectActor = {}) {
    return this.importProject({ source: 'campfire', url: dto.url }, actor);
  }

  async bulkImport(dto: BulkImportProjectsDto, actor: ProjectActor = {}) {
    const provider = this.providerFor(dto.source);
    const userId = await this.projectImportRepository.resolveActorUserId(actor);
    const urlInputs = uniqueNormalizedUrlInputs(dto.urls, (url) => provider.normalizeUrl(url));
    const importConcurrency = clampConcurrency(dto.importConcurrency, 1, 4, 4);
    const analysisConcurrency = clampConcurrency(dto.analysisConcurrency, 1, 4, 3);
    const imported: Array<{ originalUrl: string; url: string; leadId: string; projectId: string; companyId: string }> = [];
    const items: BulkImportItemResult[] = [];

    await runWithConcurrency(urlInputs, importConcurrency, async (item) => {
      try {
        const result = await this.importWithProvider(provider, item.url, { bulk: true, actor, userId });
        imported.push({
          originalUrl: item.originalUrl,
          url: item.url,
          leadId: result.lead.id,
          projectId: result.project.id,
          companyId: result.company.id
        });
        items.push({ originalUrl: item.originalUrl, url: item.url, status: 'imported', leadId: result.lead.id });
      } catch (error) {
        items.push({ originalUrl: item.originalUrl, url: item.url, status: 'failed', message: error instanceof Error ? error.message : '取り込みに失敗しました' });
      }
    });

    const analysisItems: BulkImportAnalysisResult[] = [];
    if (dto.analyze !== false && imported.length) {
      await runWithConcurrency(imported, analysisConcurrency, async (item) => {
        try {
          await this.ai.analyzeLead(item.leadId);
          analysisItems.push({ leadId: item.leadId, status: 'analyzed' });
        } catch (error) {
          analysisItems.push({ leadId: item.leadId, status: 'failed', message: error instanceof Error ? error.message : 'AI分析に失敗しました' });
        }
      });
    }

    const summary = buildBulkImportSummary({
      source: provider.source,
      total: urlInputs.length,
      items,
      analysisItems
    });
    await this.projectImportRepository.recordBulkImportAudit(userId, summary);

    return summary;
  }

  private async importWithProvider(provider: ProjectSourceProvider, url: string, options: ImportOptions = {}) {
    const normalizedUrl = provider.normalizeUrl(url);
    const imported = await provider.import(normalizedUrl);
    if (imported.project.status !== 'active') {
      throw new BadRequestException('現在公開中・募集中のプロジェクトだけ取り込めます。終了済み・公開前のURLは対象外です。');
    }
    const userId = options.userId ?? (await this.projectImportRepository.resolveActorUserId(options.actor));
    const result = await this.projectImportRepository.persistImportedProject(imported, { ...options, userId });

    return {
      ...result,
      scraped: imported.raw
    };
  }

  private providerFor(source?: string): ProjectSourceProvider {
    const normalizedSource = normalizeProjectSource(source);
    if (normalizedSource === 'campfire') return this.campfireProvider;
    if (normalizedSource === 'makuake') return this.makuakeProvider;
    throw unsupportedProjectSource(normalizedSource);
  }
}

type ImportOptions = {
  bulk?: boolean;
  actor?: ProjectActor;
  userId?: string | null;
};

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

