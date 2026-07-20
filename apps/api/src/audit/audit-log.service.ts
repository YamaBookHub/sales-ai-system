import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CreateAuditLogInput = {
  userId: string;
  sessionId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  after: Record<string, unknown>;
};

export type AuditLogFilters = {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
};

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: CreateAuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId || null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId || null,
        after: sanitizeAuditSnapshot(input.after) as Prisma.InputJsonObject
      }
    });
  }

  async list(page = 1, limit = 50, filters: AuditLogFilters = {}) {
    const safePage = positiveInteger(page, 1);
    const safeLimit = Math.min(100, positiveInteger(limit, 50));
    const where = this.buildWhere(filters);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        include: { user: { select: { id: true, name: true } } }
      }),
      this.prisma.auditLog.count({ where })
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        before: sanitizeAuditSnapshot(item.before),
        after: sanitizeAuditSnapshot(item.after)
      })),
      page: safePage,
      limit: safeLimit,
      total
    };
  }

  private buildWhere(filters: AuditLogFilters): Prisma.AuditLogWhereInput {
    const createdAt = filters.from || filters.to
      ? { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) }
      : undefined;
    return {
      ...(hasText(filters.userId) ? { userId: filters.userId } : {}),
      ...(hasText(filters.action) ? { action: filters.action } : {}),
      ...(hasText(filters.entityType) ? { entityType: filters.entityType } : {}),
      ...(hasText(filters.entityId) ? { entityId: filters.entityId } : {}),
      ...(createdAt ? { createdAt } : {})
    };
  }
}

const SENSITIVE_AUDIT_KEY = /(?:email|body|subject|prompt|token|secret|password|memo|message|description|summary|note|comment|feedback|instruction|nextaction|projecturl|websiteurl|inquiryurl|instagramurl|tiktokurl|\bxurl\b|originalurl|contactformurl|failedreason|rejectionreason|lossreasondetail|\breason\b|factsused|assumptions|riskflags)/i;

function sanitizeAuditSnapshot(value: unknown): Prisma.JsonValue | null {
  if (value === undefined) return null;
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return sensitiveString(value) ? '[redacted]' : value;
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditSnapshot(item));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_AUDIT_KEY.test(key) ? '[redacted]' : sanitizeAuditSnapshot(item)
    ])
  );
}

function sensitiveString(value: string): boolean {
  return /https?:\/\//i.test(value) || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(value) || value.length > 500;
}

function hasText(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

function positiveInteger(value: number, fallback: number): number {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
