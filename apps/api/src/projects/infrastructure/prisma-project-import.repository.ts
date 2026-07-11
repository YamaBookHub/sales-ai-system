import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectActor } from '../domain/project-actor';
import { normalizeSearchUrl } from '../domain/project-import-policy';
import { NormalizedImportedProject } from '../domain/project-source-provider';

export type ProjectImportPersistenceOptions = {
  bulk?: boolean;
  actor?: ProjectActor;
  userId?: string | null;
};

export type BulkImportAuditSummary = {
  source: string;
  total: number;
  imported: number;
  failed: number;
  analyzed: number;
  analysisFailed: number;
};

@Injectable()
export class PrismaProjectImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async existingProjectUrls(baseUrl: string) {
    const projects = await this.prisma.crowdfundingProject.findMany({
      where: { platform: { baseUrl } },
      select: { url: true }
    });
    return new Set(projects.map((project) => normalizeSearchUrl(project.url)));
  }

  async resolveActorUserId(actor?: ProjectActor) {
    const email = actor?.operatorEmail?.trim().toLowerCase();
    if (!email) return null;
    const user = await this.prisma.user.upsert({
      where: { email },
      update: { isActive: true },
      create: { email, name: actor?.operatorName || email, role: 'operator' }
    });
    return user.id;
  }

  async persistImportedProject(imported: NormalizedImportedProject, options: ProjectImportPersistenceOptions = {}) {
    return this.prisma.$transaction(async (tx) => {
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
                location: existingCompany.location || imported.company.location || undefined,
                sourceTotalAmount: existingCompany.sourceTotalAmount ?? imported.company.sourceTotalAmount ?? undefined,
                sourceProjectCount: existingCompany.sourceProjectCount ?? imported.company.sourceProjectCount ?? undefined,
                sourceSupporterCount: existingCompany.sourceSupporterCount ?? imported.company.sourceSupporterCount ?? undefined,
                memo: existingCompany.memo || imported.company.memo || undefined
              })
            })
          : await tx.company.create({
              data: {
                name: imported.company.name,
                normalizedName: normalizeCompanyName(imported.company.name),
                websiteUrl: imported.company.websiteUrl || undefined,
                inquiryUrl: imported.company.inquiryUrl || undefined,
                location: imported.company.location || undefined,
                sourceTotalAmount: imported.company.sourceTotalAmount ?? undefined,
                sourceProjectCount: imported.company.sourceProjectCount ?? undefined,
                sourceSupporterCount: imported.company.sourceSupporterCount ?? undefined,
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
          daysLeft: imported.project.daysLeft ?? undefined,
          description: imported.project.description,
          category: imported.project.category,
          location: imported.project.location,
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
          daysLeft: imported.project.daysLeft ?? undefined,
          description: imported.project.description,
          category: imported.project.category,
          location: imported.project.location,
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
  }

  async recordBulkImportAudit(userId: string | null | undefined, summary: BulkImportAuditSummary) {
    await this.prisma.auditLog.create({
      data: {
        action: 'projects.bulk_import',
        userId,
        entityType: 'Project',
        after: {
          source: summary.source,
          requested: summary.total,
          imported: summary.imported,
          failed: summary.failed,
          analyzed: summary.analyzed,
          analysisFailed: summary.analysisFailed
        }
      }
    });
  }
}

function normalizeCompanyName(value: string) {
  return value.trim().toLowerCase();
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '')) as Partial<T>;
}
