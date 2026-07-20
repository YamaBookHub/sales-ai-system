import { Injectable } from '@nestjs/common';
import { priorityForScore } from '../domain/lead-policy';
import { calculateLeadScore } from '../domain/lead-score';
import { PrismaLeadRepository } from '../infrastructure/prisma-lead.repository';
import { AuditActor } from '../../audit/audit-actor';

@Injectable()
export class ScoreLeadUseCase {
  constructor(private readonly leads: PrismaLeadRepository) {}

  async execute(organizationId: string, id: string, actor: AuditActor) {
    const lead = await this.leads.getForScoring(organizationId, id);
    const leadScore = calculateLeadScore({
      projectAmount: lead.project?.amount,
      supporterCount: lead.project?.supporterCount,
      category: lead.project?.category,
      endDate: lead.project?.endDate
    });

    const priority = priorityForScore(leadScore.totalScore);
    return this.leads.recordScore(organizationId, id, leadScore, priority, actor);
  }
}
