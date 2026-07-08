import { Injectable, NotFoundException } from '@nestjs/common';
import { LeadPriority, LeadStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto, UpdateLeadDto } from './leads.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 20, status?: LeadStatus, priority?: LeadPriority) {
    const skip = (page - 1) * limit;
    const where = { ...(status ? { status } : {}), ...(priority ? { priority } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.salesLead.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.salesLead.count({ where })
    ]);

    return { items, page, limit, total };
  }

  create(dto: CreateLeadDto) {
    return this.prisma.salesLead.create({
      data: {
        companyId: dto.companyId,
        projectId: dto.projectId,
        source: dto.source ?? 'manual',
        ownerMemo: dto.ownerMemo
      }
    });
  }

  async get(id: string) {
    const lead = await this.prisma.salesLead.findUnique({
      where: { id },
      include: { company: true, project: true, scores: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  update(id: string, dto: UpdateLeadDto) {
    return this.prisma.salesLead.update({ where: { id }, data: dto });
  }

  async score(id: string) {
    const lead = await this.get(id);
    const projectAmount = lead.project?.amount ?? 0;
    const supporterCount = lead.project?.supporterCount ?? 0;
    const amountScore = Math.min(30, Math.floor(projectAmount / 1000000) * 5);
    const supporterScore = Math.min(25, Math.floor(supporterCount / 100) * 5);
    const fitScore = lead.project?.category ? 20 : 10;
    const urgencyScore = lead.project?.endDate ? 10 : 5;
    const activityScore = 10;
    const totalScore = amountScore + supporterScore + fitScore + urgencyScore + activityScore;

    const score = await this.prisma.leadScore.create({
      data: {
        leadId: id,
        amountScore,
        supporterScore,
        fitScore,
        urgencyScore,
        activityScore,
        totalScore,
        reasonJson: {
          projectAmount,
          supporterCount,
          note: 'MVP scoring formula. TODO: align with docs/10_AI.md lead score details.'
        }
      }
    });

    await this.prisma.salesLead.update({ where: { id }, data: { score: totalScore } });
    return score;
  }
}
