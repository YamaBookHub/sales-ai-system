import { Injectable } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './projects.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
