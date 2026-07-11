import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LeadScoreResult } from '../domain/lead-score';

@Injectable()
export class PrismaLeadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getForScoring(id: string) {
    const lead = await this.prisma.salesLead.findUnique({
      where: { id },
      include: {
        project: true
      }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  async recordScore(leadId: string, leadScore: LeadScoreResult, leadPolicy: Record<string, unknown>) {
    return this.prisma.$transaction(async (tx) => {
      const score = await tx.leadScore.create({
        data: {
          leadId,
          ...leadScore
        }
      });

      await tx.salesLead.update({
        where: { id: leadId },
        data: {
          score: leadScore.totalScore,
          ...leadPolicy
        }
      });

      return score;
    });
  }
}
