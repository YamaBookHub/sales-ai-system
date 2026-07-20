import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockCompanyDto, CreateCompanyDto } from './companies.dto';
import { AuditActor } from '../audit/audit-actor';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { organizationId, deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.company.count({ where })
    ]);

    return { items, page, limit, total };
  }

  create(dto: CreateCompanyDto, actor: AuditActor) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          organizationId: actor.organizationId,
          name: dto.name,
          normalizedName: dto.name.trim().toLowerCase(),
          websiteUrl: dto.websiteUrl,
          inquiryUrl: dto.inquiryUrl,
          industry: dto.industry,
          memo: dto.memo
        }
      });
      await tx.auditLog.create({
        data: {
          ...actor,
          action: 'company.created',
          entityType: 'Company',
          entityId: company.id,
          after: { companyId: company.id, isBlocked: false }
        }
      });
      return company;
    });
  }

  block(id: string, dto: BlockCompanyDto, actor: AuditActor) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.company.findFirstOrThrow({
        where: { id, organizationId: actor.organizationId, deletedAt: null },
        select: { isBlocked: true }
      });
      const company = await tx.company.update({
        where: { organizationId_id: { organizationId: actor.organizationId, id } },
        data: {
          isBlocked: true,
          blockedReason: dto.blockedReason ?? 'blocked_by_user'
        }
      });
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
      return company;
    });
  }
}
