import { Injectable, NotFoundException } from '@nestjs/common';
import { LeadPriority, LeadStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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

    return { items: items.map((lead) => withTaskSummary(sanitizeLeadMemos(lead))), page, limit, total };
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

    return withTaskSummary(sanitizeLeadMemos(lead));
  }

  async update(id: string, dto: UpdateLeadDto) {
    const lead = await this.prisma.salesLead.findUnique({ where: { id } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const {
      companyName,
      projectTitle,
      projectUrl,
      projectSource,
      projectStatus,
      projectAmount,
      projectSupporterCount,
      projectTargetAmount,
      projectEndDate,
      projectCategory,
      projectDescription,
      nextActionAt,
      sentAt,
      nextFollowUpAt,
      ...leadDto
    } = dto;

    const companyData = compactData({
      name: companyName,
      normalizedName: companyName ? normalizeCompanyName(companyName) : undefined
    });
    const projectData = compactData({
      title: projectTitle,
      url: projectUrl,
      status: projectStatus,
      amount: projectAmount,
      supporterCount: projectSupporterCount,
      targetAmount: projectTargetAmount,
      endDate: projectEndDate ? new Date(projectEndDate) : undefined,
      category: projectCategory,
      description: projectDescription
    });
    const leadData = compactData({
      ...leadDto,
      nextActionAt: parseOptionalDate(nextActionAt),
      sentAt: parseOptionalDate(sentAt),
      nextFollowUpAt: parseOptionalDate(nextFollowUpAt)
    });
    const leadPolicy = applyLeadPolicy({
      status: leadData.status,
      priority: leadData.priority,
      nextActionAt: leadData.nextActionAt,
      nextFollowUpAt: leadData.nextFollowUpAt
    });

    return this.prisma.$transaction(async (tx) => {
      if (Object.keys(companyData).length) {
        await tx.company.update({ where: { id: lead.companyId }, data: companyData });
      }
      if (lead.projectId && Object.keys(projectData).length) {
        const platform = projectSource
          ? await tx.crowdfundingPlatform.upsert({
              where: {
                type_baseUrl: {
                  type: projectSource,
                  baseUrl: platformBaseUrl(projectSource)
                }
              },
              update: { name: platformName(projectSource), isActive: true },
              create: {
                type: projectSource,
                name: platformName(projectSource),
                baseUrl: platformBaseUrl(projectSource)
              }
            })
          : null;
        await tx.crowdfundingProject.update({
          where: { id: lead.projectId },
          data: { ...projectData, ...(platform ? { platformId: platform.id } : {}), scrapedAt: new Date() }
        });
      }
      return sanitizeLeadMemos(await tx.salesLead.update({
        where: { id },
        data: { ...leadData, ...leadPolicy },
        include: {
          company: true,
          project: { include: { platform: true } },
          scores: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      }));
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

function platformName(type: 'campfire' | 'makuake' | 'green_funding' | 'other') {
  return ({
    campfire: 'CAMPFIRE',
    makuake: 'Makuake',
    green_funding: 'GREEN FUNDING',
    other: 'その他'
  })[type];
}

function platformBaseUrl(type: 'campfire' | 'makuake' | 'green_funding' | 'other') {
  return ({
    campfire: 'https://camp-fire.jp',
    makuake: 'https://www.makuake.com',
    green_funding: 'https://greenfunding.jp',
    other: 'https://example.com'
  })[type];
}

function sanitizeLeadMemos<T extends { project?: { title?: string | null; description?: string | null; category?: string | null } | null; brandAnalysisMemo?: string | null; snsAnalysisMemo?: string | null }>(lead: T): T {
  const source = [lead.project?.title, lead.project?.description, lead.project?.category].filter(Boolean).join(' ');
  return {
    ...lead,
    brandAnalysisMemo: isMemoCompatibleWithProject(lead.brandAnalysisMemo, source) ? lead.brandAnalysisMemo : null,
    snsAnalysisMemo: isMemoCompatibleWithProject(lead.snsAnalysisMemo, source) ? lead.snsAnalysisMemo : null
  };
}

function withTaskSummary<T extends { tasks?: TaskRecord[]; _count?: { tasks: number } }>(lead: T) {
  const nextTask = lead.tasks?.[0] ? toTaskView(lead.tasks[0]) : null;
  const activeTaskCount = lead._count?.tasks || 0;
  const { tasks: _tasks, _count: _count, ...rest } = lead;
  return { ...rest, nextTask, activeTaskCount };
}

function isMemoCompatibleWithProject(memo?: string | null, projectSource = '') {
  if (!memo || !projectSource) return true;
  const rules = [
    { pattern: /米びつ|米櫃|お米|キッチン|真空保存|鮮度|保存容器|収納/, required: /米びつ|米櫃|お米|キッチン|真空保存|鮮度|保存容器|収納/ },
    { pattern: /醤油差し|醤油|サイフォン|有田焼|陶磁器|器|食卓|残量|ガラス管|NEO CLAY/i, required: /醤油差し|醤油|サイフォン|有田焼|陶磁器|器|食卓|残量|ガラス管|NEO CLAY/i },
    { pattern: /エアベッド|寝心地|車中泊|キャンプ|アウトドア|来客|寝具/, required: /エアベッド|ベッド|寝心地|車中泊|キャンプ|アウトドア|来客|寝具/ },
    { pattern: /ライブ|コンサート|ファン|音楽|バンド|周年|公演/, required: /ライブ|コンサート|ファン|音楽|バンド|周年|公演/ },
    { pattern: /焼き鳥|焼鳥|炭火|店舗|飲食|居酒屋|リフォーム|改装/, required: /焼き鳥|焼鳥|炭火|店舗|飲食|居酒屋|リフォーム|改装/ }
  ];
  return rules.every((rule) => !rule.pattern.test(memo) || rule.required.test(projectSource));
}
