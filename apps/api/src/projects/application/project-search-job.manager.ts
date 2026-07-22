import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  countImportableSearchItems,
  mergeSearchItems,
  normalizeSearchUrl,
  normalizeResultLimit,
  progressiveSearchLimits
} from '../domain/project-import-policy';
import {
  ProjectSearchJobRepository,
  PROJECT_SEARCH_JOB_HEARTBEAT_MS,
  PROJECT_SEARCH_JOB_LEASE_MS,
  PROJECT_SEARCH_JOB_TTL_MS,
  StoredProjectSearchJob
} from '../domain/project-search-job';
import {
  ProjectSearchDiagnostics,
  ProjectSearchOptions,
  ProjectSearchResult,
  ProjectSourceProvider,
  ProjectSourceSearchError
} from '../domain/project-source-provider';
import {
  decideProjectSearchCompletion,
  ProjectSearchCompletionReason,
  projectSearchCompletionMessage
} from '../domain/project-search-completion';
import { SearchCampfireProjectsDto } from '../projects.dto';
import { PrismaProjectImportRepository } from '../infrastructure/prisma-project-import.repository';
import { StructuredLogger } from '../../common/logging/structured-logger.service';

type SearchWithProvider = (
  provider: ProjectSourceProvider,
  dto: SearchCampfireProjectsDto,
  options?: ProjectSearchOptions
) => Promise<Awaited<ReturnType<ProjectSourceProvider['search']>>>;

type ActiveWorker = {
  organizationId: string;
  ownerUserId: string;
  controller: AbortController;
};

@Injectable()
export class ProjectSearchJobManager {
  private readonly activeWorkers = new Map<string, ActiveWorker>();

  constructor(
    private readonly projectImportRepository: PrismaProjectImportRepository,
    private readonly searchJobRepository: ProjectSearchJobRepository,
    private readonly logger: StructuredLogger
  ) {}

  async start(
    organizationId: string,
    ownerUserId: string,
    provider: ProjectSourceProvider,
    dto: SearchCampfireProjectsDto,
    searchWithProvider: SearchWithProvider
  ) {
    const desiredLimit = normalizeResultLimit(dto.limit);
    const now = new Date();
    await this.searchJobRepository.deleteExpired(now);

    const job = await this.searchJobRepository.create({
      id: randomUUID(),
      organizationId,
      ownerUserId,
      workerId: randomUUID(),
      status: 'running',
      source: provider.source,
      request: { ...dto },
      desiredLimit,
      searchedLimit: 0,
      items: [],
      itemCount: 0,
      importableCount: 0,
      message: '検索を開始しました',
      leaseExpiresAt: new Date(now.getTime() + PROJECT_SEARCH_JOB_LEASE_MS),
      expiresAt: new Date(now.getTime() + PROJECT_SEARCH_JOB_TTL_MS),
      startedAt: now,
      updatedAt: now
    });
    this.abortSupersededLocalWorkers(organizationId, ownerUserId);
    const controller = new AbortController();
    this.activeWorkers.set(job.id, { organizationId, ownerUserId, controller });
    void this.runSearchJob(job, provider, dto, searchWithProvider, controller);
    return this.publicSearchJob(job);
  }

  async get(id: string, organizationId: string, ownerUserId: string) {
    const now = new Date();
    let job = await this.searchJobRepository.findOwned(id, organizationId, ownerUserId, now);
    if (!job) throw searchJobNotFound();
    if (job.status === 'running' && job.leaseExpiresAt.getTime() <= now.getTime()) {
      const message = projectSearchCompletionMessage({
        reason: 'failed',
        desiredLimit: job.desiredLimit,
        itemCount: job.itemCount,
        importableCount: job.importableCount,
        errorMessage: '実行サーバーが停止したため検索を終了しました。もう一度検索してください。'
      });
      job = await this.searchJobRepository.failExpiredLease(
        id,
        organizationId,
        ownerUserId,
        now,
        message,
        expiresAt(now)
      );
      if (!job) throw searchJobNotFound();
    }
    return this.publicSearchJob(job);
  }

  async cancel(id: string, organizationId: string, ownerUserId: string) {
    const current = await this.searchJobRepository.findOwned(id, organizationId, ownerUserId, new Date());
    if (!current) throw searchJobNotFound();
    const message = projectSearchCompletionMessage({
      reason: 'cancelled',
      desiredLimit: current.desiredLimit,
      itemCount: current.itemCount,
      importableCount: current.importableCount
    });
    const cancelled = await this.searchJobRepository.requestCancel(
      id,
      organizationId,
      ownerUserId,
      message,
      new Date(),
      expiresAt()
    );
    if (!cancelled) throw searchJobNotFound();
    this.activeWorkers.get(id)?.controller.abort();
    return this.publicSearchJob(cancelled);
  }

  private async runSearchJob(
    job: StoredProjectSearchJob,
    provider: ProjectSourceProvider,
    dto: SearchCampfireProjectsDto,
    searchWithProvider: SearchWithProvider,
    controller: AbortController
  ) {
    const stopMonitor = this.monitorWorker(job, controller);
    try {
      const existingUrls = await this.projectImportRepository.existingProjectUrls(job.organizationId, provider.baseUrl);
      const excludeUrls = Array.from(new Set([...(dto.excludeUrls || []), ...existingUrls]));
      for (const limit of progressiveSearchLimits(job.desiredLimit)) {
        if (controller.signal.aborted) return;
        job.searchedLimit = limit;
        job.message = `候補を取得中です（最大${limit}件まで確認中）`;
        if (!(await this.persistProgress(job))) return controller.abort();

        const result = await searchWithProvider(
          provider,
          { ...dto, limit, excludeUrls },
          {
            signal: controller.signal,
            onItems: (items) => this.addObservedItems(job, items, existingUrls, controller)
          }
        );
        if (controller.signal.aborted) return;
        job.diagnostics = result.diagnostics;
        if (!(await this.addObservedItems(job, result.items, existingUrls, controller))) return;
        if (job.importableCount >= job.desiredLimit) break;
      }
      if (controller.signal.aborted) return;

      const completionReason = decideProjectSearchCompletion({
        desiredLimit: job.desiredLimit,
        importableCount: job.importableCount,
        dto,
        diagnostics: job.diagnostics
      });
      await this.finish(job, completionReason === 'failed' ? 'failed' : 'completed', completionReason);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ProjectSourceSearchError) {
        this.logger.errorEvent('scraper.search_failed', {
          organizationId: job.organizationId,
          userId: job.ownerUserId,
          entityType: 'ProjectSearchJob',
          entityId: job.id,
          operation: 'search',
          source: provider.source,
          error: error.sourceError
        });
      }
      job.message = projectSearchCompletionMessage({
        reason: 'failed',
        desiredLimit: job.desiredLimit,
        itemCount: job.itemCount,
        importableCount: job.importableCount,
        errorMessage: error instanceof ProjectSourceSearchError
          ? '取得元への接続に失敗しました。'
          : '検索処理に失敗しました。'
      });
      await this.finish(job, 'failed', 'failed', job.message);
    } finally {
      stopMonitor();
      if (this.activeWorkers.get(job.id)?.controller === controller) this.activeWorkers.delete(job.id);
    }
  }

  private async addObservedItems(
    job: StoredProjectSearchJob,
    items: ProjectSearchResult[],
    existingUrls: Set<string>,
    controller: AbortController
  ) {
    if (controller.signal.aborted) return false;
    if (!items.length) return true;

    const importableItems = items.filter((item) => !existingUrls.has(normalizeSearchUrl(item.url)));
    job.items = mergeSearchItems(job.items, importableItems).slice(0, job.desiredLimit);
    job.itemCount = job.items.length;
    job.importableCount = countImportableSearchItems(job.items, existingUrls);
    job.message = `候補 ${job.itemCount}件 / 取込可能 ${job.importableCount}件`;
    const saved = await this.persistProgress(job);
    if (!saved) controller.abort();
    return saved;
  }

  private persistProgress(job: StoredProjectSearchJob) {
    const now = new Date();
    return this.searchJobRepository.updateProgress(
      job.id,
      job.workerId,
      {
        searchedLimit: job.searchedLimit,
        items: job.items,
        itemCount: job.itemCount,
        importableCount: job.importableCount,
        diagnostics: job.diagnostics,
        message: job.message
      },
      new Date(now.getTime() + PROJECT_SEARCH_JOB_LEASE_MS),
      new Date(now.getTime() + PROJECT_SEARCH_JOB_TTL_MS)
    );
  }

  private async finish(
    job: StoredProjectSearchJob,
    status: 'completed' | 'failed',
    completionReason: ProjectSearchCompletionReason,
    messageOverride?: string
  ) {
    job.status = status;
    job.completionReason = completionReason;
    job.message = messageOverride || projectSearchCompletionMessage({
      reason: completionReason,
      desiredLimit: job.desiredLimit,
      itemCount: job.itemCount,
      importableCount: job.importableCount
    });
    await this.searchJobRepository.finish(
      job.id,
      job.workerId,
      {
        status,
        items: job.items,
        itemCount: job.itemCount,
        importableCount: job.importableCount,
        diagnostics: job.diagnostics,
        completionReason,
        message: job.message
      },
      expiresAt()
    );
  }

  private monitorWorker(job: StoredProjectSearchJob, controller: AbortController) {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      if (stopped || controller.signal.aborted) return;
      try {
        const control = await this.searchJobRepository.findWorkerControl(job.id, job.workerId);
        if (!control || control.status !== 'running' || control.cancelRequestedAt) {
          controller.abort();
          return;
        }
        const now = new Date();
        const renewed = await this.searchJobRepository.heartbeat(
          job.id,
          job.workerId,
          new Date(now.getTime() + PROJECT_SEARCH_JOB_LEASE_MS),
          new Date(now.getTime() + PROJECT_SEARCH_JOB_TTL_MS)
        );
        if (!renewed) {
          controller.abort();
          return;
        }
      } catch {
        controller.abort();
        return;
      }
      if (!stopped) {
        timer = setTimeout(check, PROJECT_SEARCH_JOB_HEARTBEAT_MS);
        timer.unref?.();
      }
    };
    timer = setTimeout(check, PROJECT_SEARCH_JOB_HEARTBEAT_MS);
    timer.unref?.();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }

  private abortSupersededLocalWorkers(organizationId: string, ownerUserId: string) {
    for (const worker of this.activeWorkers.values()) {
      if (worker.organizationId === organizationId && worker.ownerUserId === ownerUserId) worker.controller.abort();
    }
  }

  private publicSearchJob(job: StoredProjectSearchJob) {
    return {
      id: job.id,
      status: job.status,
      source: job.source,
      desiredLimit: job.desiredLimit,
      searchedLimit: job.searchedLimit,
      items: job.items,
      itemCount: job.itemCount,
      importableCount: job.importableCount,
      diagnostics: job.diagnostics,
      completionReason: job.completionReason,
      message: job.message,
      startedAt: job.startedAt.toISOString(),
      updatedAt: job.updatedAt.toISOString()
    };
  }
}

function expiresAt(now = new Date()) {
  return new Date(now.getTime() + PROJECT_SEARCH_JOB_TTL_MS);
}

function searchJobNotFound() {
  return new NotFoundException('検索ジョブが見つかりません。もう一度検索してください。');
}
