import { Injectable } from '@nestjs/common';
import { applyLeadPolicy } from '../domain/lead-policy';
import { calculateLeadScore } from '../domain/lead-score';
import { PrismaLeadRepository } from '../infrastructure/prisma-lead.repository';

@Injectable()
export class ScoreLeadUseCase {
  constructor(private readonly leads: PrismaLeadRepository) {}

  async execute(id: string) {
    const lead = await this.leads.getForScoring(id);
    const leadScore = calculateLeadScore({
      projectAmount: lead.project?.amount,
      supporterCount: lead.project?.supporterCount,
      category: lead.project?.category,
      endDate: lead.project?.endDate
    });

    return this.leads.recordScore(id, leadScore, applyLeadPolicy({ score: leadScore.totalScore }));
  }
}
