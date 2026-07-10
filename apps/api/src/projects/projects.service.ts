import { BadRequestException, Injectable } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { CampfireProjectSourceProvider } from './campfire-project-source.provider';
import { MakuakeProjectSourceProvider } from './makuake-project-source.provider';
import { NormalizedImportedProject, ProjectSourceProvider } from './project-source-provider';
import { BulkImportProjectsDto, CreateProjectDto, ImportCampfireProjectDto, ImportProjectDto, ProjectSource, SearchCampfireProjectsDto, SearchProjectsDto } from './projects.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly campfireProvider: CampfireProjectSourceProvider,
    private readonly makuakeProvider: MakuakeProjectSourceProvider
  ) {}

  async list(page = 1, limit = 20, status?: ProjectStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.crowdfundingProject.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.crowdfundingProject.count({ where })
    ]);

    return { items, page, limit, total };
  }

  create(dto: CreateProjectDto) {
    return this.prisma.crowdfundingProject.create({
      data: {
        platformId: dto.platformId,
        companyId: dto.companyId,
        title: dto.title,
        url: dto.url,
        status: dto.status ?? 'unknown',
        amount: dto.amount ?? 0,
        supporterCount: dto.supporterCount ?? 0,
        category: dto.category
      }
    });
  }

  searchProjects(dto: SearchProjectsDto) {
    const provider = this.providerFor(dto.source);
    return this.searchWithProvider(provider, dto);
  }

  async searchCampfire(dto: SearchCampfireProjectsDto) {
    return this.searchWithProvider(this.providerFor('campfire'), dto);
  }

  async searchWithProvider(provider: ProjectSourceProvider, dto: SearchCampfireProjectsDto) {
    const existingProjects = await this.prisma.crowdfundingProject.findMany({
      where: {
        platform: {
          baseUrl: provider.baseUrl
        }
      },
      select: { url: true }
    });
    const excludeUrls = Array.from(new Set([
      ...(dto.excludeUrls || []),
      ...existingProjects.map((project) => project.url)
    ].filter(Boolean)));

    return provider.search({ ...dto, excludeUrls });
  }

  campfireCategories() {
    return this.providerFor('campfire').categories();
  }

  categories(source = 'campfire') {
    return this.providerFor(source).categories();
  }

  importProject(dto: ImportProjectDto, actor: ProjectActor = {}) {
    return this.importWithProvider(this.providerFor(dto.source), dto.url, { actor });
  }

  async importCampfire(dto: ImportCampfireProjectDto, actor: ProjectActor = {}) {
    return this.importProject({ source: 'campfire', url: dto.url }, actor);
  }

  async bulkImport(dto: BulkImportProjectsDto, actor: ProjectActor = {}) {
    const provider = this.providerFor(dto.source);
    const userId = await this.resolveActorUserId(actor);
    const urlInputs = Array.from(
      new Map(
        (dto.urls || [])
          .map((originalUrl) => ({
            originalUrl,
            url: provider.normalizeUrl(originalUrl)
          }))
          .filter((item) => item.url)
          .map((item) => [item.url, item])
      ).values()
    );
    const importConcurrency = clampConcurrency(dto.importConcurrency, 1, 4, 4);
    const analysisConcurrency = clampConcurrency(dto.analysisConcurrency, 1, 4, 3);
    const imported: Array<{ originalUrl: string; url: string; leadId: string; projectId: string; companyId: string }> = [];
    const items: Array<{ originalUrl: string; url: string; status: 'imported' | 'failed'; leadId?: string; message?: string }> = [];

    await runWithConcurrency(urlInputs, importConcurrency, async (item) => {
      try {
        const result = await this.importWithProvider(provider, item.url, { bulk: true, actor, userId });
        imported.push({
          originalUrl: item.originalUrl,
          url: item.url,
          leadId: result.lead.id,
          projectId: result.project.id,
          companyId: result.company.id
        });
        items.push({ originalUrl: item.originalUrl, url: item.url, status: 'imported', leadId: result.lead.id });
      } catch (error) {
        items.push({ originalUrl: item.originalUrl, url: item.url, status: 'failed', message: error instanceof Error ? error.message : '取り込みに失敗しました' });
      }
    });

    const analysisItems: Array<{ leadId: string; status: 'analyzed' | 'failed'; message?: string }> = [];
    if (dto.analyze !== false && imported.length) {
      await runWithConcurrency(imported, analysisConcurrency, async (item) => {
        try {
          await this.ai.analyzeLead(item.leadId);
          analysisItems.push({ leadId: item.leadId, status: 'analyzed' });
        } catch (error) {
          analysisItems.push({ leadId: item.leadId, status: 'failed', message: error instanceof Error ? error.message : 'AI分析に失敗しました' });
        }
      });
    }

    await this.prisma.auditLog.create({
      data: {
        action: 'projects.bulk_import',
        userId,
        entityType: 'Project',
        after: {
          source: provider.source,
          requested: urlInputs.length,
          imported: items.filter((item) => item.status === 'imported').length,
          failed: items.filter((item) => item.status === 'failed').length,
          analyzed: analysisItems.filter((item) => item.status === 'analyzed').length,
          analysisFailed: analysisItems.filter((item) => item.status === 'failed').length
        }
      }
    });

    return {
      source: provider.source,
      total: urlInputs.length,
      imported: items.filter((item) => item.status === 'imported').length,
      failed: items.filter((item) => item.status === 'failed').length,
      analyzed: analysisItems.filter((item) => item.status === 'analyzed').length,
      analysisFailed: analysisItems.filter((item) => item.status === 'failed').length,
      items,
      analysisItems
    };
  }

  private async importWithProvider(provider: ProjectSourceProvider, url: string, options: ImportOptions = {}) {
    const normalizedUrl = provider.normalizeUrl(url);
    const imported = await provider.import(normalizedUrl);
    if (imported.project.status !== 'active') {
      throw new BadRequestException('現在公開中・募集中のプロジェクトだけ取り込めます。終了済み・公開前のURLは対象外です。');
    }
    const userId = options.userId ?? (await this.resolveActorUserId(options.actor));
    const result = await this.persistImportedProject(imported, { ...options, userId });

    return {
      ...result,
      scraped: imported.raw
    };
  }

  private async persistImportedProject(imported: NormalizedImportedProject, options: ImportOptions = {}) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `project-import:${imported.project.url}`);
      const platform = await tx.crowdfundingPlatform.upsert({
        where: {
          type_baseUrl: {
            type: imported.platform.type,
            baseUrl: imported.platform.baseUrl
          }
        },
        update: { isActive: true },
        create: {
          type: imported.platform.type,
          name: imported.platform.name,
          baseUrl: imported.platform.baseUrl
        }
      });
      const existingCompany = await tx.company.findFirst({
        where: {
          normalizedName: normalizeCompanyName(imported.company.name),
          deletedAt: null
        }
      });
      const company =
        existingCompany
          ? await tx.company.update({
              where: { id: existingCompany.id },
              data: compact({
                websiteUrl: existingCompany.websiteUrl || imported.company.websiteUrl || undefined,
                inquiryUrl: existingCompany.inquiryUrl || imported.company.inquiryUrl || undefined,
                memo: existingCompany.memo || imported.company.memo || undefined
              })
            })
          : await tx.company.create({
              data: {
                name: imported.company.name,
                normalizedName: normalizeCompanyName(imported.company.name),
                websiteUrl: imported.company.websiteUrl || undefined,
                inquiryUrl: imported.company.inquiryUrl || undefined,
                memo: imported.company.memo || undefined
              }
            });
      const project = await tx.crowdfundingProject.upsert({
        where: { url: imported.project.url },
        update: {
          platformId: platform.id,
          companyId: company.id,
          title: imported.project.title,
          status: imported.project.status,
          amount: imported.project.amount,
          supporterCount: imported.project.supporterCount,
          description: imported.project.description,
          category: imported.project.category,
          thumbnailUrl: imported.project.thumbnailUrl,
          scrapedAt: new Date()
        },
        create: {
          platformId: platform.id,
          companyId: company.id,
          title: imported.project.title,
          url: imported.project.url,
          status: imported.project.status,
          amount: imported.project.amount,
          supporterCount: imported.project.supporterCount,
          description: imported.project.description,
          category: imported.project.category,
          thumbnailUrl: imported.project.thumbnailUrl,
          scrapedAt: imported.project.scrapedAt
        }
      });
      const existingLead = await tx.salesLead.findUnique({
        where: {
          companyId_projectId: {
            companyId: company.id,
            projectId: project.id
          }
        }
      });
      const lead = await tx.salesLead.upsert({
        where: {
          companyId_projectId: {
            companyId: company.id,
            projectId: project.id
          }
        },
        update: {
          source: imported.lead.source,
          reason: imported.lead.reason,
          contactFormUrl: existingLead?.contactFormUrl || imported.lead.contactFormUrl || undefined,
          brandWebsiteUrl: existingLead?.brandWebsiteUrl || imported.lead.brandWebsiteUrl || undefined,
          instagramUrl: existingLead?.instagramUrl || imported.lead.instagramUrl || undefined,
          tiktokUrl: existingLead?.tiktokUrl || imported.lead.tiktokUrl || undefined,
          xUrl: existingLead?.xUrl || imported.lead.xUrl || undefined,
          contactMemo: existingLead?.contactMemo || imported.lead.contactMemo || undefined,
          brandAnalysisMemo: existingLead?.brandAnalysisMemo || imported.lead.brandAnalysisMemo || undefined
        },
        create: {
          companyId: company.id,
          projectId: project.id,
          source: imported.lead.source,
          status: 'qualified',
          priority: 'medium',
          reason: imported.lead.reason,
          contactFormUrl: imported.lead.contactFormUrl || undefined,
          brandWebsiteUrl: imported.lead.brandWebsiteUrl || undefined,
          instagramUrl: imported.lead.instagramUrl || undefined,
          tiktokUrl: imported.lead.tiktokUrl || undefined,
          xUrl: imported.lead.xUrl || undefined,
          contactMemo: imported.lead.contactMemo,
          brandAnalysisMemo: imported.lead.brandAnalysisMemo
        }
      });

      await tx.auditLog.create({
        data: {
          action: options.bulk ? 'projects.bulk_import.item' : 'projects.import',
          userId: options.userId,
          entityType: 'SalesLead',
          entityId: lead.id,
          after: {
            source: imported.source,
            platform: imported.platform.name,
            projectUrl: imported.project.url,
            projectId: project.id,
            companyId: company.id
          }
        }
      });

      return { platform, company, project, lead };
    });

    return result;
  }

  private providerFor(source?: string): ProjectSourceProvider {
    const normalizedSource = normalizeProjectSource(source);
    if (normalizedSource === 'campfire') return this.campfireProvider;
    if (normalizedSource === 'makuake') return this.makuakeProvider;
    throw unsupportedProjectSource(normalizedSource);
  }

  private async resolveActorUserId(actor?: ProjectActor) {
    const email = actor?.operatorEmail?.trim().toLowerCase();
    if (!email) return null;
    const user = await this.prisma.user.upsert({
      where: { email },
      update: { isActive: true },
      create: { email, name: actor?.operatorName || email, role: 'operator' }
    });
    return user.id;
  }
}

type ProjectActor = {
  operatorEmail?: string;
  operatorName?: string;
};

type ImportOptions = {
  bulk?: boolean;
  actor?: ProjectActor;
  userId?: string | null;
};

function normalizeProjectSource(source?: string): ProjectSource {
  const normalized = (source || 'campfire').trim().toLowerCase().replace('-', '_');
  if (normalized === 'campfire' || normalized === 'makuake' || normalized === 'green_funding') {
    return normalized;
  }
  throw new BadRequestException(`未対応の取得元です: ${source || '未指定'}`);
}

function unsupportedProjectSource(source: ProjectSource) {
  return new BadRequestException(`${sourceLabel(source)}は準備中です。現在はCAMPFIREのみ検索・取り込みできます。`);
}

function sourceLabel(source: ProjectSource) {
  return ({
    campfire: 'CAMPFIRE',
    makuake: 'Makuake',
    green_funding: 'GREEN FUNDING'
  })[source];
}

function normalizeCompanyName(value: string) {
  return value.trim().toLowerCase();
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '')) as Partial<T>;
}

function clampConcurrency(value: number | undefined, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let nextIndex = 0;
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const runNext = async (): Promise<void> => {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= items.length) return;
    await worker(items[index], index);
    await runNext();
  };
  await Promise.all(Array.from({ length: safeConcurrency }, () => runNext()));
}
