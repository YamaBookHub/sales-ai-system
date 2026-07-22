import { ProjectSearchDiagnostics, ProjectSearchResult, ProjectSourceProvider } from './project-source-provider';
import { ProjectSearchCompletionReason } from './project-search-completion';

export type ProjectSearchJobStatus = 'running' | 'completed' | 'cancelled' | 'failed';

export type StoredProjectSearchJob = {
  id: string;
  organizationId: string;
  ownerUserId: string;
  workerId: string;
  status: ProjectSearchJobStatus;
  source: ProjectSourceProvider['source'];
  request: Record<string, unknown>;
  desiredLimit: number;
  searchedLimit: number;
  items: ProjectSearchResult[];
  itemCount: number;
  importableCount: number;
  diagnostics?: ProjectSearchDiagnostics;
  completionReason?: ProjectSearchCompletionReason;
  message: string;
  cancelRequestedAt?: Date;
  leaseExpiresAt: Date;
  expiresAt: Date;
  startedAt: Date;
  updatedAt: Date;
};

export type ProjectSearchJobProgress = Pick<
  StoredProjectSearchJob,
  'searchedLimit' | 'items' | 'itemCount' | 'importableCount' | 'message'
> & {
  diagnostics?: ProjectSearchDiagnostics;
};

export type ProjectSearchJobTerminalUpdate = Pick<
  StoredProjectSearchJob,
  'status' | 'items' | 'itemCount' | 'importableCount' | 'message' | 'completionReason'
> & {
  diagnostics?: ProjectSearchDiagnostics;
};

export type ProjectSearchJobControl = Pick<StoredProjectSearchJob, 'status' | 'cancelRequestedAt' | 'leaseExpiresAt'>;

export abstract class ProjectSearchJobRepository {
  abstract create(input: StoredProjectSearchJob): Promise<StoredProjectSearchJob>;
  abstract findOwned(
    id: string,
    organizationId: string,
    ownerUserId: string,
    now: Date
  ): Promise<StoredProjectSearchJob | null>;
  abstract findWorkerControl(id: string, workerId: string): Promise<ProjectSearchJobControl | null>;
  abstract updateProgress(
    id: string,
    workerId: string,
    progress: ProjectSearchJobProgress,
    leaseExpiresAt: Date,
    expiresAt: Date
  ): Promise<boolean>;
  abstract heartbeat(id: string, workerId: string, leaseExpiresAt: Date, expiresAt: Date): Promise<boolean>;
  abstract finish(
    id: string,
    workerId: string,
    update: ProjectSearchJobTerminalUpdate,
    expiresAt: Date
  ): Promise<boolean>;
  abstract requestCancel(
    id: string,
    organizationId: string,
    ownerUserId: string,
    message: string,
    now: Date,
    expiresAt: Date
  ): Promise<StoredProjectSearchJob | null>;
  abstract failExpiredLease(
    id: string,
    organizationId: string,
    ownerUserId: string,
    now: Date,
    message: string,
    expiresAt: Date
  ): Promise<StoredProjectSearchJob | null>;
  abstract deleteExpired(now: Date): Promise<number>;
}

export const PROJECT_SEARCH_JOB_TTL_MS = 30 * 60 * 1000;
export const PROJECT_SEARCH_JOB_LEASE_MS = 15 * 1000;
export const PROJECT_SEARCH_JOB_HEARTBEAT_MS = 500;
