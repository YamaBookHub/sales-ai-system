import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../../audit/audit-log.service';
import type { AuditActor } from '../../audit/audit-actor';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import type { StoredProjectSearchJob } from '../domain/project-search-job';

@Injectable()
export class ProjectOperationsAuditService {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly logger: StructuredLogger
  ) {}

  async recordSearchFinished(job: StoredProjectSearchJob, finishedAt = new Date()) {
    if (job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') return;
    try {
      await this.auditLog.record({
        organizationId: job.organizationId,
        userId: job.ownerUserId,
        action: 'projects.search_finished',
        entityType: 'ProjectSearchJob',
        entityId: job.id,
        after: {
          source: job.source,
          status: job.status,
          durationMs: Math.max(0, finishedAt.getTime() - job.startedAt.getTime()),
          itemCount: Math.max(0, job.itemCount),
          importableCount: Math.max(0, job.importableCount),
          completionReason: job.completionReason || job.status
        }
      });
    } catch (error) {
      this.logger.warnEvent('projects.search_audit_failed', {
        organizationId: job.organizationId,
        entityType: 'ProjectSearchJob',
        entityId: job.id,
        operation: 'search_monitoring',
        source: job.source,
        error
      });
    }
  }

  async recordDirectImportFailure(actor: AuditActor, source: string) {
    try {
      await this.auditLog.record({
        organizationId: actor.organizationId,
        userId: actor.userId,
        sessionId: actor.sessionId,
        action: 'projects.import_failed',
        entityType: 'CrowdfundingProject',
        after: { source, status: 'failed' }
      });
    } catch (error) {
      this.logger.warnEvent('projects.import_audit_failed', {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityType: 'CrowdfundingProject',
        operation: 'import_monitoring',
        source,
        error
      });
    }
  }
}
