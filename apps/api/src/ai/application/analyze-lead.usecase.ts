import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { materialEngagementForClickCount } from '../../tracking/domain/material-engagement-policy';
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

    const materialEngagement = await loadMaterialEngagement(this.prisma, leadId);
    const analysis = buildLocalLeadAnalysis({ ...lead, materialEngagement });

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

async function loadMaterialEngagement(prisma: PrismaService, leadId: string) {
  const links = await prisma.trackedLink.findMany({
    where: { email: { leadId }, label: 'company_material' },
    include: { clicks: { orderBy: { clickedAt: 'desc' } } }
  });
  const clickDates = links.flatMap((link) => link.clicks.map((click) => click.clickedAt));
  const lastMaterialClickAt = clickDates.reduce<Date | null>((latest, current) => {
    return !latest || current > latest ? current : latest;
  }, null);
  const engagement = materialEngagementForClickCount(clickDates.length);

  return {
    materialViewed: clickDates.length > 0,
    materialClickCount: clickDates.length,
    lastMaterialClickAt: lastMaterialClickAt?.toISOString() || null,
    appointmentAngle: engagement.label
  };
}
