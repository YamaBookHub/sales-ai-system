import { ProjectOperationsAuditService } from './project-operations-audit.service';

describe('ProjectOperationsAuditService', () => {
  const job = {
    id: 'job_1', organizationId: 'org_1', ownerUserId: 'user_1', source: 'campfire', status: 'completed',
    startedAt: new Date('2026-07-25T00:00:00.000Z'), itemCount: 4, importableCount: 3, completionReason: 'desired_reached'
  } as any;

  it('writes only the safe terminal search fields', async () => {
    const auditLog = { record: jest.fn().mockResolvedValue(undefined) };
    const logger = { warnEvent: jest.fn() };
    const service = new ProjectOperationsAuditService(auditLog as any, logger as any);

    await service.recordSearchFinished(job, new Date('2026-07-25T00:00:01.250Z'));

    expect(auditLog.record).toHaveBeenCalledWith({
      organizationId: 'org_1', userId: 'user_1', action: 'projects.search_finished', entityType: 'ProjectSearchJob', entityId: 'job_1',
      after: { source: 'campfire', status: 'completed', durationMs: 1250, itemCount: 4, importableCount: 3, completionReason: 'desired_reached' }
    });
  });

  it('does not interrupt search or import when monitoring audit persistence fails', async () => {
    const auditLog = { record: jest.fn().mockRejectedValue(new Error('audit database unavailable')) };
    const logger = { warnEvent: jest.fn() };
    const service = new ProjectOperationsAuditService(auditLog as any, logger as any);

    await expect(service.recordSearchFinished(job)).resolves.toBeUndefined();
    await expect(service.recordDirectImportFailure({ organizationId: 'org_1', userId: 'user_1', sessionId: 'session_1' }, 'makuake'))
      .resolves.toBeUndefined();
    expect(logger.warnEvent).toHaveBeenCalledTimes(2);
  });

  it('writes direct import failures without URL or error text', async () => {
    const auditLog = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new ProjectOperationsAuditService(auditLog as any, { warnEvent: jest.fn() } as any);

    await service.recordDirectImportFailure({ organizationId: 'org_1', userId: 'user_1', sessionId: 'session_1' }, 'makuake');

    expect(auditLog.record).toHaveBeenCalledWith({
      organizationId: 'org_1', userId: 'user_1', sessionId: 'session_1', action: 'projects.import_failed', entityType: 'CrowdfundingProject',
      after: { source: 'makuake', status: 'failed' }
    });
  });
});
