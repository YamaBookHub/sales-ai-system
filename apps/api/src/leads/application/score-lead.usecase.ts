import { Injectable } from '@nestjs/common';
import { priorityForScore } from '../domain/lead-policy';
import { calculateLeadScore } from '../domain/lead-score';
import { PrismaLeadRepository } from '../infrastructure/prisma-lead.repository';
import { AuditActor } from '../../audit/audit-actor';

@Injectable()
export class ScoreLeadUseCase {
  constructor(private readonly leads: PrismaLeadRepository) {}

  async execute(id: string, actor?: AuditActor) {
    const lead = await this.leads.getForScoring(id);
    const leadScore = calculateLeadScore({
      projectAmount: lead.project?.amount,
      supporterCount: lead.project?.supporterCount,
      category: lead.project?.category,
      endDate: lead.project?.endDate
    });

    const priority = priorityForScore(leadScore.totalScore);
    return actor
      ? this.leads.recordScore(id, leadScore, priority, actor)
      : this.leads.recordScore(id, leadScore, priority);
  }
}
