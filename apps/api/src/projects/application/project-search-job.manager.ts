import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  countImportableSearchItems,
  mergeSearchItems,
  normalizeResultLimit,
  progressiveSearchLimits
} from '../domain/project-import-policy';
import { ProjectSourceProvider } from '../domain/project-source-provider';
import { SearchCampfireProjectsDto } from '../projects.dto';
import { PrismaProjectImportRepository } from '../infrastructure/prisma-project-import.repository';

type SearchJob = {
  id: string;
  status: 'running' | 'completed' | 'cancelled' | 'failed';
  source: ProjectSourceProvider['source'];
  desiredLimit: number;
  searchedLimit: number;
  items: Awaited<ReturnType<ProjectSourceProvider['search']>>['items'];
  importableCount: number;
  message: string;
  startedAt: string;
  updatedAt: string;
  cancelled: boolean;
};

type SearchWithProvider = (
  provider: ProjectSourceProvider,
  dto: SearchCampfireProjectsDto
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
      cancelled: false
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
      job.message = '検索を停止しました';
      job.updatedAt = new Date().toISOString();
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
        const result = await searchWithProvider(provider, { ...dto, limit, excludeUrls });
        job.items = mergeSearchItems(job.items, result.items);
        job.importableCount = countImportableSearchItems(job.items, existingUrls);
        job.message = `候補 ${job.items.length}件 / 取込可能 ${job.importableCount}件`;
        job.updatedAt = new Date().toISOString();
        if (job.importableCount >= job.desiredLimit) break;
      }
      if (!job.cancelled) {
        job.status = 'completed';
        job.message = `検索完了: 候補 ${job.items.length}件 / 取込可能 ${job.importableCount}件`;
        job.updatedAt = new Date().toISOString();
      }
    } catch (error) {
      job.status = 'failed';
      job.message = error instanceof Error ? error.message : '検索に失敗しました';
      job.updatedAt = new Date().toISOString();
    }
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
