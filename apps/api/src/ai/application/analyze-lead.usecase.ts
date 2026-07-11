import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { buildLocalLeadAnalysis } from '../domain/local-lead-analysis';

@Injectable()
export class AnalyzeLeadUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(leadId: string) {
    const lead = await this.prisma.salesLead.findUnique({
      where: { id: leadId },
      include: { company: true, project: { include: { platform: true } } }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const analysis = buildLocalLeadAnalysis(lead);

    const aiGeneration = await this.prisma.aiGeneration.create({
      data: {
        leadId: lead.id,
        type: 'project_summary',
        provider: 'local',
        model: 'rule_based_v1',
        promptVersion: 'v1_local_lead_analysis',
        inputJson: {
          leadId,
          ...analysis.input
        },
        outputJson: analysis.output,
        latencyMs: 0
      }
    });

    return { aiGenerationId: aiGeneration.id, output: analysis.output };
  }
}

