import { BadRequestException, Injectable } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import type { AuditActor } from '../audit/audit-actor';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectSourceRegistry } from './domain/project-source-registry';
import { CreateProjectDto } from './projects.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sourceRegistry: ProjectSourceRegistry
  ) {}

  async list(organizationId: string, page = 1, limit = 20, status?: ProjectStatus) {
    const skip = (page - 1) * limit;
    const where = { organizationId, ...(status ? { status } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.crowdfundingProject.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.crowdfundingProject.count({ where })
    ]);

    return { items, page, limit, total };
  }

  async create(dto: CreateProjectDto, actor: AuditActor) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.companyId) {
        const company = await tx.company.findFirst({
          where: { id: dto.companyId, organizationId: actor.organizationId, deletedAt: null },
          select: { id: true }
        });
        if (!company) throw new BadRequestException('企業が見つかりません。');
      }
      const project = await tx.crowdfundingProject.create({
        data: {
          organizationId: actor.organizationId,
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

      await tx.auditLog.create({
        data: {
          ...actor,
          action: 'project.created',
          entityType: 'CrowdfundingProject',
          entityId: project.id,
          after: {
            platformId: project.platformId,
            companyId: project.companyId,
            status: project.status,
            amount: project.amount,
            supporterCount: project.supporterCount,
            category: project.category
          }
        }
      });

      return project;
    });
  }

  campfireCategories() {
    return this.sourceRegistry.get('campfire').categories();
  }

  categories(source = 'campfire') {
    return this.sourceRegistry.get(source).categories();
  }

  sources() {
    return { items: this.sourceRegistry.list() };
  }
}
