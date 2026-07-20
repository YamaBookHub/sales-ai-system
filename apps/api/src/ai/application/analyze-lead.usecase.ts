import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuditActor } from '../../audit/audit-actor';
import { materialEngagementForClickCount } from '../../tracking/domain/material-engagement-policy';
import { buildLocalLeadAnalysis } from '../domain/local-lead-analysis';
import { normalizeStructuredAnalysis, projectSourceFingerprint } from '../domain/lead-analysis';

@Injectable()
export class AnalyzeLeadUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(leadId: string, actor: AuditActor | null = null) {
    const lead = await this.prisma.salesLead.findUnique({
      where: { id: leadId },
      include: { company: true, project: { include: { platform: true } } }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (!lead.project) throw new ConflictException('この営業対象には案件が紐づいていません。');

    const materialEngagement = await loadMaterialEngagement(this.prisma, leadId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `lead-analysis:${leadId}`);
      const currentLead = await tx.salesLead.findUnique({
        where: { id: leadId },
        include: { company: true, project: { include: { platform: true } } }
      });
      if (!currentLead) throw new NotFoundException('Lead not found');
      if (!currentLead.project) throw new ConflictException('この営業対象には案件が紐づいていません。');

      const analysis = buildLocalLeadAnalysis({ ...currentLead, materialEngagement });
      const generatedAt = new Date();
      const aiGeneration = await tx.aiGeneration.create({
        data: {
          leadId: currentLead.id,
          type: 'project_summary',
          provider: 'local',
          model: 'rule_based_v1',
          promptVersion: 'v1_local_lead_analysis',
          inputJson: { leadId, ...analysis.input },
          outputJson: analysis.output,
          latencyMs: 0
        }
      });
      const latest = await tx.leadAnalysisRevision.findFirst({
        where: { leadId },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        select: { version: true }
      });
      const placeholders = normalizeStructuredAnalysis(analysis.output.mailPlaceholders);
      const analysisRevision = await tx.leadAnalysisRevision.create({
        data: {
          leadId,
          projectId: currentLead.project.id,
          sourceGenerationId: aiGeneration.id,
          changedById: actor?.userId ?? null,
          version: (latest?.version || 0) + 1,
          status: 'draft',
          origin: 'generated',
          ...placeholders,
          sourceFingerprint: projectSourceFingerprint(currentLead.project),
          generatedAt,
          humanEdited: false,
          editedFields: []
        }
      });
      if (actor) {
        await tx.auditLog.create({
          data: {
            userId: actor.userId,
            sessionId: actor.sessionId,
            action: 'analysis.generated',
            entityType: 'LeadAnalysisRevision',
            entityId: analysisRevision.id,
            after: { leadId, version: analysisRevision.version, status: analysisRevision.status, provider: 'local' }
          }
        });
      }
      return { aiGenerationId: aiGeneration.id, analysisRevisionId: analysisRevision.id, output: analysis.output };
    });
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
