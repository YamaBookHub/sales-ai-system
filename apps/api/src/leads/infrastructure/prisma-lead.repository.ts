import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LeadPriority } from '@prisma/client';
import { LeadScoreResult } from '../domain/lead-score';
import { AuditActor } from '../../audit/audit-actor';

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

  async recordScore(leadId: string, leadScore: LeadScoreResult, priority?: LeadPriority, actor?: AuditActor) {
    return this.prisma.$transaction(async (tx) => {
      const score = await tx.leadScore.create({
        data: {
          leadId,
          ...leadScore
        }
      });

      const lead = await tx.salesLead.update({
        where: { id: leadId },
        data: {
          score: leadScore.totalScore,
          ...(priority ? { priority } : {})
        }
      });
      if (actor) {
        await tx.auditLog.create({
          data: {
            ...actor,
            action: 'lead.scored',
            entityType: 'SalesLead',
            entityId: leadId,
            after: {
              leadId,
              scoreId: score.id,
              totalScore: lead.score,
              priority: lead.priority,
              scoreComponents: ['amountScore', 'supporterScore', 'urgencyScore', 'fitScore', 'activityScore']
            }
          }
        });
      }

      return score;
    });
  }
}
