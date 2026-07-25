import { Injectable } from '@nestjs/common';
import { AiUsageStatus, EmailStatus, Prisma, ProjectSearchJobStatus, ReplyCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OPERATIONS_MAIL_STATUSES,
  OPERATIONS_REPLY_CATEGORIES,
  OPERATIONS_SOURCES,
  OperationsMailStatus,
  OperationsPeriod,
  OperationsReportData,
  OperationsReplyCategory,
  OperationsSearchStatus,
  OperationsSource
} from '../domain/operations-report';
import { OperationsReportRepository } from '../domain/operations-report.repository';

const SAFE_SEARCH_ACTION = 'projects.search_finished';
const SAFE_IMPORT_ACTIONS = ['projects.import', 'projects.import_failed', 'projects.bulk_import'] as const;

@Injectable()
export class PrismaOperationsReportRepository implements OperationsReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async summarize(organizationId: string, period: OperationsPeriod): Promise<OperationsReportData> {
    const createdWithinPeriod = { gte: period.startUtc, lt: period.endExclusiveUtc };
    const now = new Date(period.asOf);
    const [aiRows, terminalSearchAudits, runningSearches, importAudits, replyRows, mailRows, stuckSendingCount, staleReservedAiCount] = await Promise.all([
      this.prisma.aiUsageLedger.findMany({
        where: { organizationId, createdAt: createdWithinPeriod },
        select: { status: true, estimatedCostUsd: true, actualCostUsd: true }
      }),
      this.prisma.auditLog.findMany({
        where: { organizationId, action: SAFE_SEARCH_ACTION, createdAt: createdWithinPeriod },
        select: { action: true, after: true }
      }),
      this.prisma.projectSearchJob.findMany({
        where: { organizationId, status: ProjectSearchJobStatus.running, startedAt: createdWithinPeriod },
        select: { source: true }
      }),
      this.prisma.auditLog.findMany({
        where: { organizationId, action: { in: [...SAFE_IMPORT_ACTIONS] }, createdAt: createdWithinPeriod },
        select: { action: true, after: true }
      }),
      this.prisma.emailReply.groupBy({
        by: ['category'],
        where: { organizationId, receivedAt: createdWithinPeriod },
        _count: { _all: true }
      }),
      this.prisma.outreachEmail.groupBy({
        by: ['status'],
        where: { organizationId, createdAt: createdWithinPeriod },
        _count: { _all: true }
      }),
      this.prisma.outreachEmail.count({
        where: {
          organizationId,
          status: EmailStatus.sending,
          updatedAt: { lte: new Date(now.getTime() - 15 * 60 * 1000) }
        }
      }),
      this.prisma.aiUsageLedger.count({
        where: {
          organizationId,
          status: AiUsageStatus.reserved,
          createdAt: { lte: new Date(now.getTime() - 30 * 60 * 1000) }
        }
      })
    ]);

    return {
      aiRows: aiRows.map((row) => ({
        status: toAiStatus(row.status),
        estimatedCostUsd: decimalToNumber(row.estimatedCostUsd),
        actualCostUsd: row.actualCostUsd === null ? null : decimalToNumber(row.actualCostUsd)
      })),
      terminalSearches: terminalSearchAudits.flatMap((row) => parseSearchAudit(row.after)),
      runningSearches: runningSearches.flatMap((row) => {
        const source = asSource(row.source);
        return source ? [{ source }] : [];
      }),
      imports: importAudits.flatMap((row) => parseImportAudit(row.action, row.after)),
      replies: replyRows.flatMap((row) => {
        const category = asReplyCategory(row.category);
        return category ? [{ category, count: row._count._all }] : [];
      }),
      mails: mailRows.flatMap((row) => {
        const status = asMailStatus(row.status);
        return status ? [{ status, count: row._count._all }] : [];
      }),
      stuckSendingCount,
      staleReservedAiCount
    };
  }
}

function parseSearchAudit(value: Prisma.JsonValue | null) {
  if (!isRecord(value)) return [];
  const source = asSource(value.source);
  const status = asSearchStatus(value.status);
  const durationMs = asNonNegativeInteger(value.durationMs);
  if (!source || !status || durationMs === null) return [];
  return [{ source, status, durationMs }];
}

function parseImportAudit(action: string, value: Prisma.JsonValue | null): OperationsReportData['imports'] {
  if (!isRecord(value)) return [];
  const source = asSource(value.source);
  if (!source || !SAFE_IMPORT_ACTIONS.includes(action as (typeof SAFE_IMPORT_ACTIONS)[number])) return [];
  if (action === 'projects.import') {
    return [{ action: 'projects.import', source, requested: 1, imported: 1, failed: 0, analysisFailed: 0 }];
  }
  if (action === 'projects.import_failed') {
    return value.status === 'failed'
      ? [{ action: 'projects.import_failed', source, requested: 1, imported: 0, failed: 1, analysisFailed: 0 }]
      : [];
  }
  const requested = asNonNegativeInteger(value.requested);
  const imported = asNonNegativeInteger(value.imported);
  const failed = asNonNegativeInteger(value.failed);
  const analysisFailed = asNonNegativeInteger(value.analysisFailed);
  if (requested === null || imported === null || failed === null || analysisFailed === null) return [];
  return [{ action: 'projects.bulk_import' as const, source, requested, imported, failed, analysisFailed }];
}

function toAiStatus(status: AiUsageStatus): 'completed' | 'failed' | 'reserved' {
  return status;
}

function asSource(value: unknown): OperationsSource | null {
  return typeof value === 'string' && (OPERATIONS_SOURCES as readonly string[]).includes(value) ? value as OperationsSource : null;
}

function asReplyCategory(value: ReplyCategory): OperationsReplyCategory | null {
  return (OPERATIONS_REPLY_CATEGORIES as readonly string[]).includes(value) ? value : null;
}

function asMailStatus(value: EmailStatus): OperationsMailStatus | null {
  return (OPERATIONS_MAIL_STATUSES as readonly string[]).includes(value) ? value : null;
}

function asSearchStatus(value: unknown): OperationsSearchStatus | null {
  return value === 'completed' || value === 'failed' || value === 'cancelled' ? value : null;
}

function asNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function decimalToNumber(value: { toString(): string } | number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
