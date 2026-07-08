import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockCompanyDto, CreateCompanyDto } from './companies.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.company.count()
    ]);

    return { items, page, limit, total };
  }

  create(dto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: {
        name: dto.name,
        normalizedName: dto.name.trim().toLowerCase(),
        websiteUrl: dto.websiteUrl,
        inquiryUrl: dto.inquiryUrl,
        industry: dto.industry,
        memo: dto.memo
      }
    });
  }

  block(id: string, dto: BlockCompanyDto) {
    return this.prisma.company.update({
      where: { id },
      data: {
        isBlocked: true,
        blockedReason: dto.blockedReason ?? 'blocked_by_user'
      }
    });
  }
}
