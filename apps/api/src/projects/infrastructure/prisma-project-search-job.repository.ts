import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ProjectSearchJobControl,
  ProjectSearchJobProgress,
  ProjectSearchJobRepository,
  ProjectSearchJobTerminalUpdate,
  StoredProjectSearchJob
} from '../domain/project-search-job';
import { ProjectSearchCompletionReason } from '../domain/project-search-completion';
import { ProjectSearchDiagnostics, ProjectSearchResult } from '../domain/project-source-provider';

const SUPERSEDED_MESSAGE = '新しい検索ジョブを開始したため停止しました';

type ProjectSearchJobRow = {
  id: string;
  organizationId: string;
  ownerUserId: string;
  workerId: string;
  status: StoredProjectSearchJob['status'];
  source: string;
  request: Prisma.JsonValue;
  desiredLimit: number;
  searchedLimit: number;
  items: Prisma.JsonValue;
  itemCount: number;
  importableCount: number;
  diagnostics: Prisma.JsonValue | null;
  completionReason: string | null;
  message: string;
  cancelRequestedAt: Date | null;
  leaseExpiresAt: Date;
  expiresAt: Date;
  startedAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaProjectSearchJobRepository extends ProjectSearchJobRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: StoredProjectSearchJob): Promise<StoredProjectSearchJob> {
    return this.prisma.$transaction(async (tx) => {
      // Serializes replacement jobs for one owner across API instances.
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        `project-search-job:${input.organizationId}:${input.ownerUserId}`
      );

      const runningJobs = await tx.projectSearchJob.findMany({
        where: {
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: 'running'
        },
        select: {
          id: true,
          source: true,
          startedAt: true,
          itemCount: true,
          importableCount: true,
          expiresAt: true
        }
      });
      const extendedExpiresAt = runningJobs.reduce(
        (latest, job) => (job.expiresAt > latest ? job.expiresAt : latest),
        input.expiresAt
      );

      await tx.projectSearchJob.updateMany({
        where: {
          organizationId: input.organizationId,
          ownerUserId: input.ownerUserId,
          status: 'running'
        },
        data: {
          status: 'cancelled',
          cancelRequestedAt: input.startedAt,
          completionReason: 'cancelled',
          message: SUPERSEDED_MESSAGE,
          leaseExpiresAt: input.startedAt,
          expiresAt: extendedExpiresAt
        }
      });
      if (runningJobs.length) {
        await tx.auditLog.createMany({
          data: runningJobs.map((job) => ({
            organizationId: input.organizationId,
            userId: input.ownerUserId,
            action: 'projects.search_finished',
            entityType: 'ProjectSearchJob',
            entityId: job.id,
            createdAt: input.startedAt,
            after: {
              source: job.source,
              status: 'cancelled',
              durationMs: Math.max(0, input.startedAt.getTime() - job.startedAt.getTime()),
              itemCount: Math.max(0, job.itemCount),
              importableCount: Math.max(0, job.importableCount),
              completionReason: 'cancelled'
            }
          }))
        });
      }

      const job = await tx.projectSearchJob.create({ data: toCreateData(input) });
      return toStoredProjectSearchJob(job);
    });
  }

  async findOwned(id: string, organizationId: string, ownerUserId: string, now: Date) {
    const job = await this.prisma.projectSearchJob.findFirst({
      where: { id, organizationId, ownerUserId, expiresAt: { gt: now } }
    });
    return job ? toStoredProjectSearchJob(job) : null;
  }

  async findWorkerControl(id: string, workerId: string): Promise<ProjectSearchJobControl | null> {
    const job = await this.prisma.projectSearchJob.findFirst({
      where: { id, workerId },
      select: { status: true, cancelRequestedAt: true, leaseExpiresAt: true }
    });
    return job
      ? { ...job, cancelRequestedAt: job.cancelRequestedAt ?? undefined }
      : null;
  }

  async updateProgress(
    id: string,
    workerId: string,
    progress: ProjectSearchJobProgress,
    leaseExpiresAt: Date,
    expiresAt: Date
  ) {
    const updated = await this.prisma.projectSearchJob.updateMany({
      where: activeWorkerWhere(id, workerId),
      data: {
        searchedLimit: progress.searchedLimit,
        items: toJsonInput(progress.items),
        itemCount: progress.itemCount,
        importableCount: progress.importableCount,
        diagnostics: progress.diagnostics ? toJsonInput(progress.diagnostics) : Prisma.DbNull,
        message: progress.message,
        leaseExpiresAt,
        expiresAt
      }
    });
    return updated.count === 1;
  }

  async heartbeat(id: string, workerId: string, leaseExpiresAt: Date, expiresAt: Date) {
    const updated = await this.prisma.projectSearchJob.updateMany({
      where: activeWorkerWhere(id, workerId),
      data: { leaseExpiresAt, expiresAt }
    });
    return updated.count === 1;
  }

  async finish(id: string, workerId: string, update: ProjectSearchJobTerminalUpdate, expiresAt: Date) {
    const updated = await this.prisma.projectSearchJob.updateMany({
      where: activeWorkerWhere(id, workerId),
      data: {
        status: update.status,
        items: toJsonInput(update.items),
        itemCount: update.itemCount,
        importableCount: update.importableCount,
        diagnostics: update.diagnostics ? toJsonInput(update.diagnostics) : Prisma.DbNull,
        completionReason: update.completionReason ?? null,
        message: update.message,
        expiresAt
      }
    });
    return updated.count === 1;
  }

  async requestCancel(
    id: string,
    organizationId: string,
    ownerUserId: string,
    message: string,
    now: Date,
    expiresAt: Date
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.projectSearchJob.updateMany({
        where: {
          id,
          organizationId,
          ownerUserId,
          status: 'running',
          expiresAt: { gt: now }
        },
        data: {
          status: 'cancelled',
          cancelRequestedAt: now,
          completionReason: 'cancelled',
          message,
          leaseExpiresAt: now,
          expiresAt
        }
      });
      const job = await tx.projectSearchJob.findFirst({
        where: { id, organizationId, ownerUserId, expiresAt: { gt: now } }
      });
      return job ? toStoredProjectSearchJob(job) : null;
    });
  }

  async failExpiredLease(
    id: string,
    organizationId: string,
    ownerUserId: string,
    now: Date,
    message: string,
    expiresAt: Date
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.projectSearchJob.updateMany({
        where: {
          id,
          organizationId,
          ownerUserId,
          status: 'running',
          cancelRequestedAt: null,
          leaseExpiresAt: { lte: now },
          expiresAt: { gt: now }
        },
        data: {
          status: 'failed',
          completionReason: 'failed',
          message,
          expiresAt
        }
      });
      const job = await tx.projectSearchJob.findFirst({
        where: { id, organizationId, ownerUserId, expiresAt: { gt: now } }
      });
      return job ? toStoredProjectSearchJob(job) : null;
    });
  }

  async deleteExpired(now: Date): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const abandoned = await tx.projectSearchJob.findMany({
        where: { status: 'running', expiresAt: { lte: now } },
        select: {
          id: true,
          organizationId: true,
          ownerUserId: true,
          source: true,
          startedAt: true,
          leaseExpiresAt: true,
          itemCount: true,
          importableCount: true
        }
      });
      if (abandoned.length) {
        await tx.auditLog.createMany({
          data: abandoned.map((job) => ({
            organizationId: job.organizationId,
            userId: job.ownerUserId,
            action: 'projects.search_finished',
            entityType: 'ProjectSearchJob',
            entityId: job.id,
            createdAt: job.leaseExpiresAt,
            after: {
              source: job.source,
              status: 'failed',
              durationMs: Math.max(0, job.leaseExpiresAt.getTime() - job.startedAt.getTime()),
              itemCount: Math.max(0, job.itemCount),
              importableCount: Math.max(0, job.importableCount),
              completionReason: 'failed'
            }
          }))
        });
      }
      const deleted = await tx.projectSearchJob.deleteMany({ where: { expiresAt: { lte: now } } });
      return deleted.count;
    });
  }
}

function activeWorkerWhere(id: string, workerId: string) {
  return {
    id,
    workerId,
    status: 'running' as const,
    cancelRequestedAt: null,
    leaseExpiresAt: { gt: new Date() },
    expiresAt: { gt: new Date() }
  };
}

function toCreateData(input: StoredProjectSearchJob) {
  return {
    id: input.id,
    organizationId: input.organizationId,
    ownerUserId: input.ownerUserId,
    workerId: input.workerId,
    status: input.status,
    source: input.source,
    request: toJsonInput(input.request),
    desiredLimit: input.desiredLimit,
    searchedLimit: input.searchedLimit,
    items: toJsonInput(input.items),
    itemCount: input.itemCount,
    importableCount: input.importableCount,
    diagnostics: input.diagnostics ? toJsonInput(input.diagnostics) : Prisma.DbNull,
    completionReason: input.completionReason ?? null,
    message: input.message,
    cancelRequestedAt: input.cancelRequestedAt ?? null,
    leaseExpiresAt: input.leaseExpiresAt,
    expiresAt: input.expiresAt,
    startedAt: input.startedAt,
    updatedAt: input.updatedAt
  };
}

function toStoredProjectSearchJob(job: ProjectSearchJobRow): StoredProjectSearchJob {
  return {
    id: job.id,
    organizationId: job.organizationId,
    ownerUserId: job.ownerUserId,
    workerId: job.workerId,
    status: job.status,
    source: job.source as StoredProjectSearchJob['source'],
    request: asRecord(job.request),
    desiredLimit: job.desiredLimit,
    searchedLimit: job.searchedLimit,
    items: asItems(job.items),
    itemCount: job.itemCount,
    importableCount: job.importableCount,
    diagnostics: asDiagnostics(job.diagnostics),
    completionReason: job.completionReason as ProjectSearchCompletionReason | undefined,
    message: job.message,
    cancelRequestedAt: job.cancelRequestedAt ?? undefined,
    leaseExpiresAt: job.leaseExpiresAt,
    expiresAt: job.expiresAt,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt
  };
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError('Project search job JSON must be serializable');
  }
  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

function asRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asItems(value: Prisma.JsonValue): ProjectSearchResult[] {
  return Array.isArray(value) ? (value as ProjectSearchResult[]) : [];
}

function asDiagnostics(value: Prisma.JsonValue | null): ProjectSearchDiagnostics | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as ProjectSearchDiagnostics)
    : undefined;
}
