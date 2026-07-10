import { Injectable } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CampfireScraperService } from '../scraper/campfire-scraper.service';
import { CreateProjectDto, ImportCampfireProjectDto, SearchCampfireProjectsDto } from './projects.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campfireScraper: CampfireScraperService
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

  async searchCampfire(dto: SearchCampfireProjectsDto) {
    const existingProjects = await this.prisma.crowdfundingProject.findMany({
      where: { url: { contains: 'camp-fire.jp' } },
      select: { url: true }
    });
    const excludeUrls = Array.from(new Set([
      ...(dto.excludeUrls || []),
      ...existingProjects.map((project) => project.url)
    ].filter(Boolean)));

    return this.campfireScraper.search({ ...dto, excludeUrls });
  }

  campfireCategories() {
    return this.campfireScraper.categories();
  }

  async importCampfire(dto: ImportCampfireProjectDto) {
    const scraped = await this.campfireScraper.scrape(dto.url);
    const companyName = scraped.brandName || scraped.executorName || 'CAMPFIRE実行者名未取得';
    const amount = parseInteger(scraped.supportAmount);
    const supporterCount = parseInteger(scraped.supporters);

    const result = await this.prisma.$transaction(async (tx) => {
      const platform = await tx.crowdfundingPlatform.upsert({
        where: {
          type_baseUrl: {
            type: 'campfire',
            baseUrl: 'https://camp-fire.jp'
          }
        },
        update: { isActive: true },
        create: {
          type: 'campfire',
          name: 'CAMPFIRE',
          baseUrl: 'https://camp-fire.jp'
        }
      });
      const existingCompany = await tx.company.findFirst({
        where: {
          normalizedName: normalizeCompanyName(companyName),
          deletedAt: null
        }
      });
      const company =
        existingCompany
          ? await tx.company.update({
              where: { id: existingCompany.id },
              data: compact({
                websiteUrl: existingCompany.websiteUrl || scraped.websiteUrl || undefined,
                inquiryUrl: existingCompany.inquiryUrl || scraped.inquiryUrl || undefined,
                memo: existingCompany.memo || (scraped.executorName ? `CAMPFIRE executor: ${scraped.executorName}` : undefined)
              })
            })
          : await tx.company.create({
              data: {
                name: companyName,
                normalizedName: normalizeCompanyName(companyName),
                websiteUrl: scraped.websiteUrl || undefined,
                inquiryUrl: scraped.inquiryUrl || undefined,
                memo: scraped.executorName ? `CAMPFIRE executor: ${scraped.executorName}` : undefined
              }
            });
      const project = await tx.crowdfundingProject.upsert({
        where: { url: scraped.projectUrl },
        update: {
          platformId: platform.id,
          companyId: company.id,
          title: scraped.projectTitle,
          amount,
          supporterCount,
          description: scraped.mainDescription,
          category: scraped.category || scraped.features[0],
          scrapedAt: new Date()
        },
        create: {
          platformId: platform.id,
          companyId: company.id,
          title: scraped.projectTitle,
          url: scraped.projectUrl,
          status: 'active',
          amount,
          supporterCount,
          description: scraped.mainDescription,
          category: scraped.category || scraped.features[0],
          scrapedAt: new Date()
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
          source: 'campfire_import',
          reason: buildImportReason(scraped),
          contactFormUrl: existingLead?.contactFormUrl || scraped.inquiryUrl || undefined,
          brandWebsiteUrl: existingLead?.brandWebsiteUrl || scraped.websiteUrl || undefined,
          instagramUrl: existingLead?.instagramUrl || scraped.instagramUrl || undefined,
          tiktokUrl: existingLead?.tiktokUrl || scraped.tiktokUrl || undefined,
          xUrl: existingLead?.xUrl || scraped.xUrl || undefined,
          contactMemo: existingLead?.contactMemo || buildAutoUrlMemo(scraped),
          brandAnalysisMemo: existingLead?.brandAnalysisMemo || buildLargeProfileWarning(scraped) || undefined
        },
        create: {
          companyId: company.id,
          projectId: project.id,
          source: 'campfire_import',
          status: 'qualified',
          priority: 'medium',
          reason: buildImportReason(scraped),
          contactFormUrl: scraped.inquiryUrl || undefined,
          brandWebsiteUrl: scraped.websiteUrl || undefined,
          instagramUrl: scraped.instagramUrl || undefined,
          tiktokUrl: scraped.tiktokUrl || undefined,
          xUrl: scraped.xUrl || undefined,
          contactMemo: buildAutoUrlMemo(scraped),
          brandAnalysisMemo: buildLargeProfileWarning(scraped)
        }
      });

      return { platform, company, project, lead };
    });

    return {
      ...result,
      scraped: {
        projectId: scraped.projectId,
        projectTitle: scraped.projectTitle,
        executorName: scraped.executorName,
        brandName: scraped.brandName,
        supportAmount: scraped.supportAmount,
        supporters: scraped.supporters,
        achievementRate: scraped.achievementRate,
        daysLeft: scraped.daysLeft,
        features: scraped.features,
        profileUrl: scraped.profileUrl,
        profileProjectCount: scraped.profileProjectCount,
        websiteUrl: scraped.websiteUrl,
        inquiryUrl: scraped.inquiryUrl,
        instagramUrl: scraped.instagramUrl,
        tiktokUrl: scraped.tiktokUrl,
        xUrl: scraped.xUrl,
        externalUrls: scraped.externalUrls
      }
    };
  }
}

function parseInteger(value: string) {
  const number = Number((value || '').replace(/[^0-9]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function normalizeCompanyName(value: string) {
  return value.trim().toLowerCase();
}

function buildImportReason(scraped: { achievementRate: string; daysLeft: string; features: string[] }) {
  const feature = cleanScrapedFeature(scraped.features[0]);
  const values = [scraped.achievementRate && `達成率: ${scraped.achievementRate}`, scraped.daysLeft && `残り日数: ${scraped.daysLeft}`, feature && `特徴: ${feature}`].filter(Boolean);
  return values.join(' / ') || 'CAMPFIRE import';
}

function cleanScrapedFeature(value?: string) {
  const cleaned = (value || '').trim();
  if (!cleaned || cleaned === 'カテゴリーからさがす' || cleaned === 'カテゴリからさがす') return '';
  return cleaned;
}

function buildAutoUrlMemo(scraped: { externalUrls: string[] }) {
  const notes = [];
  if (scraped.externalUrls.length) {
    notes.push(`CAMPFIREページから自動取得したURL: ${scraped.externalUrls.slice(0, 8).join(' / ')}`);
  }
  return notes.join('\n') || undefined;
}

function buildLargeProfileWarning(scraped: { profileProjectCount: number | null }) {
  if (scraped.profileProjectCount === null || scraped.profileProjectCount < 100) return undefined;
  return `注意: この実行者は過去プロジェクトが${scraped.profileProjectCount}件以上ある可能性があります。過去案件の詳細スクレイピングは重くなるため、必要な場合だけ手動確認してください。`;
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '')) as Partial<T>;
}
