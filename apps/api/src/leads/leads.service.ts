import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadPriority, LeadStatus, PlatformType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeImportedCompanyName, projectImportLockKeys } from '../projects/domain/project-import-policy';
import { applyLeadPolicy } from './domain/lead-policy';
import { ACTIVE_TASK_STATUSES, TaskRecord, toTaskView } from './domain/task';
import { CreateLeadDto, UpdateLeadDto } from './leads.dto';
import { ScoreLeadUseCase } from './application/score-lead.usecase';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoreLeadUseCase: ScoreLeadUseCase
  ) {}

  async list(page = 1, limit = 20, status?: LeadStatus, priority?: LeadPriority) {
    const skip = (page - 1) * limit;
    const where = { ...(status ? { status } : {}), ...(priority ? { priority } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.salesLead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: true,
          project: { include: { platform: true } },
          scores: { orderBy: { createdAt: 'desc' }, take: 1 },
          tasks: {
            where: { status: { in: ACTIVE_TASK_STATUSES } },
            orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
            take: 1,
            include: { assignee: { select: { id: true, name: true, email: true } } }
          },
          _count: { select: { tasks: { where: { status: { in: ACTIVE_TASK_STATUSES } } } } }
        }
      }),
      this.prisma.salesLead.count({ where })
    ]);

    return { items: items.map((lead) => withTaskSummary(lead)), page, limit, total };
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

    return this.prisma.salesLead.create({
      data: {
        companyId: dto.companyId,
        projectId: dto.projectId,
        ...leadData,
        ...applyLeadPolicy(leadData)
      }
    });
  }

  async get(id: string) {
    const lead = await this.prisma.salesLead.findUnique({
      where: { id },
      include: {
        company: true,
        project: { include: { platform: true } },
        scores: { orderBy: { createdAt: 'desc' }, take: 1 },
        tasks: {
          where: { status: { in: ACTIVE_TASK_STATUSES } },
          orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
          take: 1,
          include: { assignee: { select: { id: true, name: true, email: true } } }
        },
        _count: { select: { tasks: { where: { status: { in: ACTIVE_TASK_STATUSES } } } } }
      }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return withTaskSummary(lead);
  }

  async update(id: string, dto: UpdateLeadDto) {
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
      return tx.salesLead.update({
        where: { id },
        data: { ...leadData, ...leadPolicy },
        include: {
          company: true,
          project: { include: { platform: true } },
          scores: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      });
    });
  }

  async score(id: string) {
    return this.scoreLeadUseCase.execute(id);
  }
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
