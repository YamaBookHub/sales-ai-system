import { Injectable } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CampfireScraperService } from '../scraper/campfire-scraper.service';
import { CreateProjectDto, ImportCampfireProjectDto } from './projects.dto';

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
        existingCompany ??
        (await tx.company.create({
          data: {
            name: companyName,
            normalizedName: normalizeCompanyName(companyName),
            memo: scraped.executorName ? `CAMPFIRE executor: ${scraped.executorName}` : undefined
          }
        }));
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
      const lead = await tx.salesLead.upsert({
        where: {
          companyId_projectId: {
            companyId: company.id,
            projectId: project.id
          }
        },
        update: {
          source: 'campfire_import',
          reason: buildImportReason(scraped)
        },
        create: {
          companyId: company.id,
          projectId: project.id,
          source: 'campfire_import',
          status: 'qualified',
          priority: 'medium',
          reason: buildImportReason(scraped)
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
        profileUrl: scraped.profileUrl
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
  const values = [scraped.achievementRate && `達成率: ${scraped.achievementRate}`, scraped.daysLeft && `残り日数: ${scraped.daysLeft}`, scraped.features[0] && `特徴: ${scraped.features[0]}`].filter(Boolean);
  return values.join(' / ') || 'CAMPFIRE import';
}
