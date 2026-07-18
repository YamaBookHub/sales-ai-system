import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  countImportableSearchItems,
  mergeSearchItems,
  normalizeSearchUrl,
  normalizeResultLimit,
  progressiveSearchLimits
} from '../domain/project-import-policy';
import { ProjectSearchDiagnostics, ProjectSearchResult, ProjectSearchOptions, ProjectSourceProvider } from '../domain/project-source-provider';
import {
  decideProjectSearchCompletion,
  ProjectSearchCompletionReason,
  projectSearchCompletionMessage
} from '../domain/project-search-completion';
import { SearchCampfireProjectsDto } from '../projects.dto';
import { PrismaProjectImportRepository } from '../infrastructure/prisma-project-import.repository';

type SearchJob = {
  id: string;
  status: 'running' | 'completed' | 'cancelled' | 'failed';
  source: ProjectSourceProvider['source'];
  desiredLimit: number;
  searchedLimit: number;
  items: ProjectSearchResult[];
  importableCount: number;
  diagnostics?: ProjectSearchDiagnostics;
  completionReason?: ProjectSearchCompletionReason;
  message: string;
  startedAt: string;
  updatedAt: string;
  cancelled: boolean;
  abortController: AbortController;
};

type SearchWithProvider = (
  provider: ProjectSourceProvider,
  dto: SearchCampfireProjectsDto,
  options?: ProjectSearchOptions
) => Promise<Awaited<ReturnType<ProjectSourceProvider['search']>>>;

@Injectable()
export class ProjectSearchJobManager {
  private readonly searchJobs = new Map<string, SearchJob>();

  constructor(private readonly projectImportRepository: PrismaProjectImportRepository) {}

  start(provider: ProjectSourceProvider, dto: SearchCampfireProjectsDto, searchWithProvider: SearchWithProvider) {
    const desiredLimit = normalizeResultLimit(dto.limit);
    this.pruneSearchJobs();
    const job: SearchJob = {
      id: randomUUID(),
      status: 'running',
      source: provider.source,
      desiredLimit,
      items: [],
      importableCount: 0,
      searchedLimit: 0,
      message: '検索を開始しました',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cancelled: false,
      abortController: new AbortController()
    };
    this.searchJobs.set(job.id, job);
    void this.runSearchJob(job, provider, dto, searchWithProvider);
    return this.publicSearchJob(job);
  }

  get(id: string) {
    const job = this.searchJobs.get(id);
    if (!job) {
      throw new BadRequestException('検索ジョブが見つかりません。もう一度検索してください。');
    }
    return this.publicSearchJob(job);
  }

  cancel(id: string) {
    const job = this.searchJobs.get(id);
    if (!job) {
      throw new BadRequestException('検索ジョブが見つかりません。もう一度検索してください。');
    }
    if (job.status === 'running') {
      job.cancelled = true;
      job.status = 'cancelled';
      job.completionReason = 'cancelled';
      job.message = projectSearchCompletionMessage({
        reason: 'cancelled',
        desiredLimit: job.desiredLimit,
        itemCount: job.items.length,
        importableCount: job.importableCount
      });
      job.updatedAt = new Date().toISOString();
      job.abortController.abort();
    }
    return this.publicSearchJob(job);
  }

  private async runSearchJob(
    job: SearchJob,
    provider: ProjectSourceProvider,
    dto: SearchCampfireProjectsDto,
    searchWithProvider: SearchWithProvider
  ) {
    try {
      const existingUrls = await this.projectImportRepository.existingProjectUrls(provider.baseUrl);
      const excludeUrls = Array.from(new Set([...(dto.excludeUrls || []), ...existingUrls]));
      for (const limit of progressiveSearchLimits(job.desiredLimit)) {
        if (job.cancelled) break;
        job.searchedLimit = limit;
        job.message = `候補を取得中です（最大${limit}件まで確認中）`;
        job.updatedAt = new Date().toISOString();
        const result = await searchWithProvider(
          provider,
          { ...dto, limit, excludeUrls },
          {
            signal: job.abortController.signal,
            onItems: (items) => this.addObservedItems(job, items, existingUrls)
          }
        );
        if (job.status !== 'running' || job.abortController.signal.aborted) return;
        job.diagnostics = result.diagnostics;
        this.addObservedItems(job, result.items, existingUrls);
        if (job.importableCount >= job.desiredLimit) break;
      }
      if (!job.cancelled) {
        const completionReason = decideProjectSearchCompletion({
          desiredLimit: job.desiredLimit,
          importableCount: job.importableCount,
          dto,
          diagnostics: job.diagnostics
        });
        job.completionReason = completionReason;
        job.status = completionReason === 'failed' ? 'failed' : 'completed';
        job.message = projectSearchCompletionMessage({
          reason: completionReason,
          desiredLimit: job.desiredLimit,
          itemCount: job.items.length,
          importableCount: job.importableCount
        });
        job.updatedAt = new Date().toISOString();
      }
    } catch (error) {
      if (job.cancelled) return;
      job.status = 'failed';
      job.completionReason = 'failed';
      job.message = projectSearchCompletionMessage({
        reason: 'failed',
        desiredLimit: job.desiredLimit,
        itemCount: job.items.length,
        importableCount: job.importableCount,
        errorMessage: error instanceof Error ? error.message : undefined
      });
      job.updatedAt = new Date().toISOString();
    }
  }

  private addObservedItems(job: SearchJob, items: ProjectSearchResult[], existingUrls: Set<string>) {
    if (job.status !== 'running' || job.cancelled || job.abortController.signal.aborted) return false;
    if (!items.length) return true;

    // mergeSearchItems preserves the first observed order while refreshing duplicate rows.
    const importableItems = items.filter((item) => !existingUrls.has(normalizeSearchUrl(item.url)));
    job.items = mergeSearchItems(job.items, importableItems).slice(0, job.desiredLimit);
    job.importableCount = countImportableSearchItems(job.items, existingUrls);
    job.message = `候補 ${job.items.length}件 / 取込可能 ${job.importableCount}件`;
    job.updatedAt = new Date().toISOString();
    return true;
  }

  private publicSearchJob(job: SearchJob) {
    return {
      id: job.id,
      status: job.status,
      source: job.source,
      desiredLimit: job.desiredLimit,
      searchedLimit: job.searchedLimit,
      items: job.items,
      itemCount: job.items.length,
      importableCount: job.importableCount,
      diagnostics: job.diagnostics,
      completionReason: job.completionReason,
      message: job.message,
      startedAt: job.startedAt,
      updatedAt: job.updatedAt
    };
  }

  private pruneSearchJobs() {
    const threshold = Date.now() - 30 * 60 * 1000;
    for (const [id, job] of this.searchJobs.entries()) {
      if (new Date(job.updatedAt).getTime() < threshold) {
        this.searchJobs.delete(id);
      }
    }
  }
}
