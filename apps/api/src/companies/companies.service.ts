import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockCompanyDto, CreateCompanyDto } from './companies.dto';
import { AuditActor } from '../audit/audit-actor';

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

  create(dto: CreateCompanyDto, actor?: AuditActor) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.name,
          normalizedName: dto.name.trim().toLowerCase(),
          websiteUrl: dto.websiteUrl,
          inquiryUrl: dto.inquiryUrl,
          industry: dto.industry,
          memo: dto.memo
        }
      });
      if (actor) {
        await tx.auditLog.create({
          data: {
            ...actor,
            action: 'company.created',
            entityType: 'Company',
            entityId: company.id,
            after: { companyId: company.id, isBlocked: false }
          }
        });
      }
      return company;
    });
  }

  block(id: string, dto: BlockCompanyDto, actor?: AuditActor) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.company.findUniqueOrThrow({ where: { id }, select: { isBlocked: true } });
      const company = await tx.company.update({
        where: { id },
        data: {
          isBlocked: true,
          blockedReason: dto.blockedReason ?? 'blocked_by_user'
        }
      });
      if (actor) {
        await tx.auditLog.create({
          data: {
            ...actor,
            action: 'company.blocked',
            entityType: 'Company',
            entityId: company.id,
            before: { isBlocked: current.isBlocked },
            after: { isBlocked: true, changedFields: ['isBlocked', 'blockedReason'] }
          }
        });
      }
      return company;
    });
  }
}
