import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailStatus, LeadPriority, LeadStatus, PlatformType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeImportedCompanyName, projectImportLockKeys } from '../projects/domain/project-import-policy';
import { applyLeadPolicy } from './domain/lead-policy';
import { ACTIVE_TASK_STATUSES, TaskRecord, toTaskView } from './domain/task';
import { classifyTodaySales, TodaySalesCategory, tokyoDateKey } from './domain/today-sales';
import {
  CreateLeadDto,
  LeadContactState,
  LeadListSort,
  LeadNextActionFilter,
  SortDirection,
  UpdateLeadDto
} from './leads.dto';
import { ScoreLeadUseCase } from './application/score-lead.usecase';
import { ensureOpportunityForLead } from './infrastructure/prisma-opportunity.repository';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoreLeadUseCase: ScoreLeadUseCase
  ) {}

  async list(
    page = 1,
    limit = 20,
    status?: LeadStatus,
    priority?: LeadPriority,
    filters: LeadListFilters = {}
  ) {
    const normalizedPage = Math.max(1, Math.floor(Number(page) || 1));
    const normalizedLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 20)));
    const input = { ...filters, status: status ?? filters.status, priority: priority ?? filters.priority };
    const now = new Date();
    const query = buildLeadListQuery(input, now, normalizedPage, normalizedLimit);

    // The list IDs, aggregate badges, and hydrated newest mail must come from one
    // PostgreSQL snapshot. This avoids both historical-mail false matches and races
    // where a mail changes after a filter has been evaluated.
    return this.prisma.$transaction(async (tx) => {
      const [stats] = await tx.$queryRaw<LeadListStats[]>(query.stats);
      const pageRows = await tx.$queryRaw<LeadListIdRow[]>(query.pageIds);
      const pageIds = pageRows.map((row) => row.id);
      const items = pageIds.length
        ? await tx.salesLead.findMany({
            where: { id: { in: pageIds } },
            include: leadListInclude
          })
        : [];
      const itemsById = new Map(items.map((lead) => [lead.id, lead]));

      return {
        items: pageIds.flatMap((id) => {
          const lead = itemsById.get(id);
          return lead ? [withTaskSummary(lead)] : [];
        }),
        page: normalizedPage,
        limit: normalizedLimit,
        total: toCount(stats?.total),
        summary: {
          total: toCount(stats?.summaryTotal),
          noContact: toCount(stats?.noContact),
          draft: toCount(stats?.draft),
          review: toCount(stats?.review),
          queued: toCount(stats?.queued)
        }
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async listToday(page = 1, limit = 50, now = new Date()) {
    const normalizedPage = Math.max(1, Math.floor(Number(page) || 1));
    const normalizedLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 50)));
    const endOfToday = tokyoEndOfDay(now);
    const candidates = await this.prisma.salesLead.findMany({
      where: {
        OR: [
          { nextActionAt: { lte: endOfToday } },
          { nextFollowUpAt: { lte: endOfToday } },
          { tasks: { some: { status: { in: ACTIVE_TASK_STATUSES }, dueAt: { lte: endOfToday } } } },
          { status: 'replied' },
          { mails: { some: { status: { in: ['draft', 'approved', 'queued', 'failed'] } } } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        company: true,
        project: { include: { platform: true } },
        opportunity: true,
        scores: { orderBy: { createdAt: 'desc' }, take: 1 },
        tasks: {
          where: { status: { in: ACTIVE_TASK_STATUSES } },
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
          take: 1,
          include: { assignee: { select: { id: true, name: true, email: true } } }
        },
        _count: { select: { tasks: { where: { status: { in: ACTIVE_TASK_STATUSES } } } } },
        mails: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { _count: { select: { replies: true } } }
        }
      }
    });

    const actionable = candidates
      .map((record) => {
        const summarized = withTaskSummary(record);
        const { mails, ...lead } = summarized;
        const mail = mails[0] || null;
        const category = classifyTodaySales({
          nextActionAt: lead.nextTask?.dueAt || lead.nextActionAt,
          nextFollowUpAt: lead.nextFollowUpAt,
          mailStatus: mail?.status,
          hasReply: lead.status === 'replied' || Boolean(mail?._count.replies)
        }, now);
        return category ? { lead, mail, category } : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => todayCategoryRank(left.category) - todayCategoryRank(right.category)
        || todayDueAt(left).localeCompare(todayDueAt(right))
        || left.lead.company.name.localeCompare(right.lead.company.name, 'ja'));

    const counts = Object.fromEntries(TODAY_CATEGORIES.map((category) => [category, actionable.filter((item) => item.category === category).length]));
    const start = (normalizedPage - 1) * normalizedLimit;
    return {
      items: actionable.slice(start, start + normalizedLimit),
      counts,
      page: normalizedPage,
      limit: normalizedLimit,
      total: actionable.length
    };
  }

  create(dto: CreateLeadDto) {
    const leadData = compactData({
      source: dto.source ?? 'manual',
      ownerMemo: dto.ownerMemo,
      nextActionAt: parseOptionalDate(dto.nextActionAt),
      contactEmail: dto.contactEmail,
      contactFormUrl: dto.contactFormUrl,
      siteMessageUrl: dto.siteMessageUrl,
      contactMemo: dto.contactMemo,
      sendMethod: dto.sendMethod,
      sentAt: parseOptionalDate(dto.sentAt),
      nextFollowUpAt: parseOptionalDate(dto.nextFollowUpAt),
      brandWebsiteUrl: dto.brandWebsiteUrl,
      instagramUrl: dto.instagramUrl,
      tiktokUrl: dto.tiktokUrl,
      xUrl: dto.xUrl,
      brandAnalysisMemo: dto.brandAnalysisMemo,
      snsAnalysisMemo: dto.snsAnalysisMemo
    });

    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.salesLead.create({
        data: {
          companyId: dto.companyId,
          projectId: dto.projectId,
          ...leadData,
          ...applyLeadPolicy(leadData)
        }
      });
      await ensureOpportunityForLead(tx, lead.id);
      return lead;
    });
  }

  async get(id: string) {
    const lead = await this.prisma.salesLead.findUnique({
      where: { id },
      include: {
        company: {
          include: {
            contacts: {
              where: { deletedAt: null, isUnsubscribed: false },
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                email: true,
                inquiryUrl: true,
                isPrimary: true,
                isUnsubscribed: true,
                deletedAt: true
              }
            }
          }
        },
        project: { include: { platform: true } },
        opportunity: true,
        scores: { orderBy: { createdAt: 'desc' }, take: 1 },
        tasks: {
          where: { status: { in: ACTIVE_TASK_STATUSES } },
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
          take: 1,
          include: { assignee: { select: { id: true, name: true, email: true } } }
        },
        mails: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { id: true, leadId: true, companyId: true, status: true, createdAt: true }
        },
        _count: { select: { tasks: { where: { status: { in: ACTIVE_TASK_STATUSES } } } } }
      }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return withTaskSummary(lead);
  }

  async update(id: string, dto: UpdateLeadDto, userId?: string) {
    const {
      companyName,
      projectTitle,
      projectUrl,
      projectSource,
      projectStatus,
      projectAmount,
      projectSupporterCount,
      projectTargetAmount,
      projectStartDate,
      projectEndDate,
      projectCategory,
      projectLocation,
      projectDescription,
      companyWebsiteUrl,
      companyInquiryUrl,
      companyIndustry,
      companyLocation,
      companySourceTotalAmount,
      companySourceProjectCount,
      companySourceSupporterCount,
      companyMemo,
      leadReason,
      nextActionAt,
      sentAt,
      nextFollowUpAt,
      ...leadDto
    } = dto;

    const companyData = compactData({
      name: companyName === undefined ? undefined : requiredTrimmed(companyName, '企業名'),
      normalizedName: companyName === undefined ? undefined : normalizeCompanyName(requiredTrimmed(companyName, '企業名')),
      websiteUrl: nullableTrimmed(companyWebsiteUrl),
      inquiryUrl: nullableTrimmed(companyInquiryUrl),
      industry: nullableTrimmed(companyIndustry),
      location: nullableTrimmed(companyLocation),
      sourceTotalAmount: companySourceTotalAmount,
      sourceProjectCount: companySourceProjectCount,
      sourceSupporterCount: companySourceSupporterCount,
      memo: nullableTrimmed(companyMemo)
    });
    const parsedProjectStartDate = parseNullableDate(projectStartDate);
    const parsedProjectEndDate = parseNullableDate(projectEndDate);
    const projectData = compactData({
      title: projectTitle === undefined ? undefined : requiredTrimmed(projectTitle, '案件名'),
      url: projectUrl === undefined ? undefined : requiredTrimmed(projectUrl, 'プロジェクトURL'),
      status: projectStatus,
      amount: projectAmount,
      supporterCount: projectSupporterCount,
      targetAmount: projectTargetAmount,
      startDate: parsedProjectStartDate,
      endDate: parsedProjectEndDate,
      daysLeft: projectEndDate === undefined ? undefined : daysUntil(parsedProjectEndDate),
      category: nullableTrimmed(projectCategory),
      location: nullableTrimmed(projectLocation),
      description: nullableTrimmed(projectDescription)
    });
    const leadData = compactData({
      ...leadDto,
      reason: nullableTrimmed(leadReason),
      ownerMemo: nullableTrimmed(leadDto.ownerMemo),
      contactEmail: nullableTrimmed(leadDto.contactEmail),
      contactFormUrl: nullableTrimmed(leadDto.contactFormUrl),
      siteMessageUrl: nullableTrimmed(leadDto.siteMessageUrl),
      contactMemo: nullableTrimmed(leadDto.contactMemo),
      sendMethod: nullableTrimmed(leadDto.sendMethod),
      brandWebsiteUrl: nullableTrimmed(leadDto.brandWebsiteUrl),
      instagramUrl: nullableTrimmed(leadDto.instagramUrl),
      tiktokUrl: nullableTrimmed(leadDto.tiktokUrl),
      xUrl: nullableTrimmed(leadDto.xUrl),
      brandAnalysisMemo: nullableTrimmed(leadDto.brandAnalysisMemo),
      snsAnalysisMemo: nullableTrimmed(leadDto.snsAnalysisMemo),
      nextActionAt: parseNullableDate(nextActionAt),
      sentAt: parseNullableDate(sentAt),
      nextFollowUpAt: parseNullableDate(nextFollowUpAt)
    });
    const leadPolicy = applyLeadPolicy({
      status: leadData.status,
      priority: leadData.priority,
      nextActionAt: leadData.nextActionAt,
      nextFollowUpAt: leadData.nextFollowUpAt
    });

    const hasProjectPatch = projectSource !== undefined || Object.keys(projectData).length > 0;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `lead-detail:${id}`);
      if (hasProjectPatch) {
        await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `lead-analysis:${id}`);
      }
      const lead = await tx.salesLead.findUnique({
        where: { id },
        include: { company: true, project: { include: { platform: true } } }
      });
      if (!lead) {
        throw new NotFoundException('Lead not found');
      }
      if (hasProjectPatch && !lead.project) {
        throw new ConflictException('この営業対象には案件が紐づいていないため、案件情報は更新できません。');
      }

      const effectiveProjectUrl = lead.project ? String(projectData.url ?? lead.project.url) : '';
      const effectiveProjectSource = lead.project ? (projectSource ?? lead.project.platform.type) : null;
      if (lead.project && hasProjectPatch && effectiveProjectSource) {
        assertProjectSourceMatchesUrl(effectiveProjectSource, effectiveProjectUrl);
      }

      const effectiveCompanyName = String(companyData.name ?? lead.company.name);
      const currentLockKeys = lead.project
        ? projectImportLockKeys(lead.project.url, lead.company.name)
        : [`project-import:company:${normalizeImportedCompanyName(lead.company.name)}`];
      const nextLockKeys = lead.project
        ? projectImportLockKeys(String(projectData.url ?? lead.project.url), effectiveCompanyName)
        : [`project-import:company:${normalizeImportedCompanyName(effectiveCompanyName)}`];
      for (const lockKey of Array.from(new Set([...currentLockKeys, ...nextLockKeys])).sort()) {
        await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', lockKey);
      }
      if (Object.keys(companyData).length) {
        await tx.company.update({ where: { id: lead.companyId }, data: companyData });
      }
      if (lead.project && hasProjectPatch) {
        const shouldRefreshPlatform = projectSource !== undefined || projectData.url !== undefined;
        const platform = shouldRefreshPlatform && effectiveProjectSource
          ? await tx.crowdfundingPlatform.upsert({
              where: {
                type_baseUrl: {
                  type: effectiveProjectSource,
                  baseUrl: platformBaseUrl(effectiveProjectSource, effectiveProjectUrl)
                }
              },
              update: { name: platformName(effectiveProjectSource), isActive: true },
              create: {
                type: effectiveProjectSource,
                name: platformName(effectiveProjectSource),
                baseUrl: platformBaseUrl(effectiveProjectSource, effectiveProjectUrl)
              }
            })
          : null;
        await tx.crowdfundingProject.update({
          where: { id: lead.project.id },
          data: { ...projectData, ...(platform ? { platformId: platform.id } : {}) }
        });
      }
      const updated = await tx.salesLead.update({
        where: { id },
        data: { ...leadData, ...leadPolicy },
        include: {
          company: true,
          project: { include: { platform: true } },
          scores: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      });
      if (userId) {
        await tx.auditLog.create({
          data: {
            userId,
            action: 'lead.updated',
            entityType: 'SalesLead',
            entityId: id,
            before: leadAuditSnapshot(lead),
            after: leadAuditSnapshot(updated)
          }
        });
      }
      return updated;
    });
  }

  async score(id: string) {
    return this.scoreLeadUseCase.execute(id);
  }
}

function leadAuditSnapshot(lead: {
  status: LeadStatus;
  priority: LeadPriority;
  score: number;
  reason: string | null;
  ownerMemo: string | null;
  contactEmail: string | null;
  contactFormUrl: string | null;
  siteMessageUrl: string | null;
  sendMethod: string | null;
  nextActionAt: Date | null;
  sentAt: Date | null;
  nextFollowUpAt: Date | null;
  company: { name: string; websiteUrl: string | null; inquiryUrl: string | null };
  project: { title: string; url: string; platform: { type: PlatformType } } | null;
}) {
  return {
    companyName: lead.company.name,
    companyWebsiteUrl: lead.company.websiteUrl,
    companyInquiryUrl: lead.company.inquiryUrl,
    projectTitle: lead.project?.title ?? null,
    projectUrl: lead.project?.url ?? null,
    projectSource: lead.project?.platform.type ?? null,
    status: lead.status,
    priority: lead.priority,
    score: lead.score,
    reason: lead.reason,
    ownerMemo: lead.ownerMemo,
    contactEmail: lead.contactEmail,
    contactFormUrl: lead.contactFormUrl,
    siteMessageUrl: lead.siteMessageUrl,
    sendMethod: lead.sendMethod,
    nextActionAt: lead.nextActionAt?.toISOString() ?? null,
    sentAt: lead.sentAt?.toISOString() ?? null,
    nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null
  };
}

type LeadListFilters = {
  keyword?: string;
  source?: PlatformType;
  status?: LeadStatus;
  priority?: LeadPriority;
  contactState?: LeadContactState;
  mailStatus?: EmailStatus | 'none';
  nextAction?: LeadNextActionFilter;
  sort?: LeadListSort;
  sortDirection?: SortDirection;
};

type LeadListStats = {
  total: bigint | number;
  summaryTotal: bigint | number;
  noContact: bigint | number;
  draft: bigint | number;
  review: bigint | number;
  queued: bigint | number;
};

type LeadListIdRow = { id: string };

type LeadListQuery = { stats: Prisma.Sql; pageIds: Prisma.Sql };

const leadListInclude = {
  company: {
    include: {
      contacts: {
        where: { deletedAt: null, isUnsubscribed: false },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          email: true,
          inquiryUrl: true,
          isPrimary: true,
          isUnsubscribed: true,
          deletedAt: true
        }
      }
    }
  },
  project: { include: { platform: true } },
  opportunity: true,
  scores: { orderBy: { createdAt: 'desc' }, take: 1 },
  tasks: {
    where: { status: { in: ACTIVE_TASK_STATUSES } },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    take: 1,
    include: { assignee: { select: { id: true, name: true, email: true } } }
  },
  mails: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { id: true, leadId: true, companyId: true, status: true, createdAt: true }
  },
  _count: { select: { tasks: { where: { status: { in: ACTIVE_TASK_STATUSES } } } } }
} satisfies Prisma.SalesLeadInclude;

function buildLeadListQuery(
  input: LeadListFilters,
  now: Date,
  page: number,
  limit: number
): LeadListQuery {
  const ctes = leadListCtes(input, now);
  const orderBy = leadListOrderBy(input.sort, input.sortDirection);
  const offset = (page - 1) * limit;

  return {
    stats: Prisma.sql`
      WITH ${ctes}
      SELECT
        (SELECT COUNT(*) FROM filtered_leads) AS "total",
        (SELECT COUNT(*) FROM summary_leads) AS "summaryTotal",
        (SELECT COUNT(*) FROM summary_leads WHERE NOT "hasContact") AS "noContact",
        (SELECT COUNT(*) FROM summary_leads WHERE "latestMailStatus" = 'draft'::"EmailStatus") AS "draft",
        (SELECT COUNT(*) FROM summary_leads WHERE "latestMailStatus" = 'in_review'::"EmailStatus") AS "review",
        (SELECT COUNT(*) FROM summary_leads WHERE "latestMailStatus" = 'queued'::"EmailStatus") AS "queued"
    `,
    pageIds: Prisma.sql`
      WITH ${ctes}
      SELECT "id"
      FROM filtered_leads
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `
  };
}

function leadListCtes(input: LeadListFilters, now: Date): Prisma.Sql {
  const baseConditions = leadListBaseConditions(input, now);
  const resultConditions = leadListResultConditions(input);
  const baseWhere = baseConditions.length ? Prisma.join(baseConditions, ' AND ') : Prisma.sql`TRUE`;
  const resultWhere = resultConditions.length ? Prisma.join(resultConditions, ' AND ') : Prisma.sql`TRUE`;

  return Prisma.sql`
    latest_mails AS (
      SELECT DISTINCT ON (mail."leadId") mail."leadId", mail."status"
      FROM "OutreachEmail" AS mail
      WHERE mail."leadId" IS NOT NULL
      ORDER BY mail."leadId", mail."createdAt" DESC, mail."id" DESC
    ),
    summary_leads AS (
      SELECT
        lead."id",
        company."name" AS "companyName",
        project."title" AS "projectTitle",
        project."amount" AS "amount",
        project."supporterCount" AS "supporterCount",
        project."daysLeft" AS "daysLeft",
        lead."score",
        lead."priority",
        lead."createdAt",
        latest_mails."status" AS "latestMailStatus",
        (
          lead."contactEmail" IS NOT NULL
          OR lead."contactFormUrl" IS NOT NULL
          OR lead."siteMessageUrl" IS NOT NULL
          OR EXISTS (
            SELECT 1
            FROM "ContactPerson" AS contact
            WHERE contact."companyId" = lead."companyId"
              AND contact."deletedAt" IS NULL
              AND contact."isUnsubscribed" = FALSE
              AND (contact."email" IS NOT NULL OR contact."inquiryUrl" IS NOT NULL)
          )
        ) AS "hasContact"
      FROM "SalesLead" AS lead
      INNER JOIN "Company" AS company ON company."id" = lead."companyId"
      LEFT JOIN "CrowdfundingProject" AS project ON project."id" = lead."projectId"
      LEFT JOIN "CrowdfundingPlatform" AS platform ON platform."id" = project."platformId"
      LEFT JOIN latest_mails ON latest_mails."leadId" = lead."id"
      WHERE ${baseWhere}
    ),
    filtered_leads AS (
      SELECT *
      FROM summary_leads
      WHERE ${resultWhere}
    )
  `;
}

function leadListBaseConditions(input: LeadListFilters, now: Date): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  if (input.keyword?.trim()) {
    const keyword = `%${input.keyword.trim()}%`;
    conditions.push(Prisma.sql`(
      company."name" ILIKE ${keyword}
      OR COALESCE(project."title", '') ILIKE ${keyword}
      OR COALESCE(project."url", '') ILIKE ${keyword}
      OR COALESCE(project."description", '') ILIKE ${keyword}
      OR COALESCE(lead."reason", '') ILIKE ${keyword}
      OR COALESCE(lead."ownerMemo", '') ILIKE ${keyword}
    )`);
  }
  if (input.source) conditions.push(Prisma.sql`platform."type" = ${input.source}::"PlatformType"`);
  if (input.status) conditions.push(Prisma.sql`lead."status" = ${input.status}::"LeadStatus"`);
  if (input.priority) conditions.push(Prisma.sql`lead."priority" = ${input.priority}::"LeadPriority"`);
  if (input.nextAction && input.nextAction !== 'any') conditions.push(nextActionSql(input.nextAction, now));
  return conditions;
}

function leadListResultConditions(input: LeadListFilters): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  if (input.contactState === 'has') conditions.push(Prisma.sql`"hasContact"`);
  if (input.contactState === 'none') conditions.push(Prisma.sql`NOT "hasContact"`);
  if (input.mailStatus === 'none') conditions.push(Prisma.sql`"latestMailStatus" IS NULL`);
  if (input.mailStatus && input.mailStatus !== 'none') {
    conditions.push(Prisma.sql`"latestMailStatus" = ${input.mailStatus}::"EmailStatus"`);
  }
  return conditions;
}

function nextActionSql(nextAction: Exclude<LeadNextActionFilter, 'any'>, now: Date): Prisma.Sql {
  const hasActiveTask = Prisma.sql`EXISTS (
    SELECT 1 FROM "Task" AS task
    WHERE task."leadId" = lead."id"
      AND task."status" IN ('todo'::"TaskStatus", 'doing'::"TaskStatus")
  )`;
  if (nextAction === 'scheduled') {
    return Prisma.sql`(lead."nextActionAt" IS NOT NULL OR lead."nextFollowUpAt" IS NOT NULL OR ${hasActiveTask})`;
  }
  if (nextAction === 'overdue') {
    return Prisma.sql`(
      lead."nextActionAt" <= ${now}
      OR lead."nextFollowUpAt" <= ${now}
      OR EXISTS (
        SELECT 1 FROM "Task" AS task
        WHERE task."leadId" = lead."id"
          AND task."status" IN ('todo'::"TaskStatus", 'doing'::"TaskStatus")
          AND task."dueAt" <= ${now}
      )
    )`;
  }
  return Prisma.sql`(lead."nextActionAt" IS NULL AND lead."nextFollowUpAt" IS NULL AND NOT ${hasActiveTask})`;
}

function leadListOrderBy(sort: LeadListSort | undefined, sortDirection: SortDirection | undefined): Prisma.Sql {
  const safeSort: LeadListSort = [
    'company', 'project', 'amount', 'supporters', 'daysLeft', 'score', 'priority', 'createdAt'
  ].includes(sort as LeadListSort)
    ? sort as LeadListSort
    : 'createdAt';
  const direction = sortDirection === 'asc' || sortDirection === 'desc'
    ? sortDirection
    : safeSort === 'createdAt' ? 'desc' : 'asc';
  const field = {
    company: Prisma.sql`"companyName"`,
    project: Prisma.sql`"projectTitle"`,
    amount: Prisma.sql`"amount"`,
    supporters: Prisma.sql`"supporterCount"`,
    daysLeft: Prisma.sql`"daysLeft"`,
    score: Prisma.sql`"score"`,
    priority: Prisma.sql`CASE "priority"
      WHEN 'low'::"LeadPriority" THEN 1
      WHEN 'medium'::"LeadPriority" THEN 2
      WHEN 'high'::"LeadPriority" THEN 3
      ELSE 0
    END`,
    createdAt: Prisma.sql`"createdAt"`
  } satisfies Record<LeadListSort, Prisma.Sql>;
  const orderDirection = direction === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  return Prisma.sql`${field[safeSort]} ${orderDirection} NULLS LAST, "id" ${orderDirection}`;
}

function toCount(value: bigint | number | undefined) {
  return value === undefined ? 0 : Number(value);
}

function compactData<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function normalizeCompanyName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseOptionalDate(value?: string) {
  return value ? new Date(value) : undefined;
}

function parseNullableDate(value?: string | null) {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

function platformName(type: 'campfire' | 'makuake' | 'green_funding' | 'other') {
  return ({
    campfire: 'CAMPFIRE',
    makuake: 'Makuake',
    green_funding: 'GREEN FUNDING',
    other: 'その他'
  })[type];
}

function platformBaseUrl(type: PlatformType, projectUrl: string) {
  return ({
    campfire: 'https://camp-fire.jp',
    makuake: 'https://www.makuake.com',
    green_funding: 'https://greenfunding.jp',
    other: new URL(projectUrl).origin
  })[type];
}

function withTaskSummary<T extends { tasks?: TaskRecord[]; _count?: { tasks: number } }>(lead: T) {
  const nextTask = lead.tasks?.[0] ? toTaskView(lead.tasks[0]) : null;
  const activeTaskCount = lead._count?.tasks || 0;
  const { tasks: _tasks, _count: _count, ...rest } = lead;
  return { ...rest, nextTask, activeTaskCount };
}

const TODAY_CATEGORIES: TodaySalesCategory[] = [
  'overdue', 'due_today', 'draft_review', 'approval_pending', 'send_queue', 'reply_received', 'send_failed'
];

function todayCategoryRank(category: TodaySalesCategory) {
  return TODAY_CATEGORIES.indexOf(category);
}

function todayDueAt(item: { lead: { nextTask?: { dueAt?: string | null } | null; nextActionAt?: Date | null; nextFollowUpAt?: Date | null } }) {
  const value = item.lead.nextTask?.dueAt || item.lead.nextActionAt || item.lead.nextFollowUpAt;
  return value ? new Date(value).toISOString() : '9999-12-31T23:59:59.999Z';
}

function tokyoEndOfDay(now: Date) {
  return new Date(`${tokyoDateKey(now)}T23:59:59.999+09:00`);
}


function nullableTrimmed(value?: string | null) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function requiredTrimmed(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new BadRequestException(`${label}は空にできません。`);
  return trimmed;
}

function daysUntil(value: Date | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return Math.max(0, Math.ceil((value.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

function assertProjectSourceMatchesUrl(source: PlatformType, projectUrl: string) {
  if (source === 'other') return;
  const hostname = new URL(projectUrl).hostname.toLowerCase();
  const matches = {
    campfire: hostname === 'camp-fire.jp' || hostname.endsWith('.camp-fire.jp'),
    makuake: hostname === 'makuake.com' || hostname.endsWith('.makuake.com'),
    green_funding: hostname === 'greenfunding.jp' || hostname.endsWith('.greenfunding.jp')
  }[source];
  if (!matches) {
    throw new BadRequestException('取得元とプロジェクトURLのドメインが一致しません。');
  }
}
