import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadAnalysisRevision } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuditActor } from '../../audit/audit-actor';
import { UpdateLeadAnalysisDto } from '../ai.dto';
import {
  editedAnalysisFields,
  isCompleteStructuredAnalysis,
  missingAnalysisFields,
  normalizeStructuredAnalysis,
  projectSourceFingerprint
} from '../domain/lead-analysis';

@Injectable()
export class LeadAnalysisUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async get(leadId: string) {
    const lead = await this.prisma.salesLead.findUnique({ where: { id: leadId }, include: { project: true } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (!lead.project) throw new ConflictException('この営業対象には案件が紐づいていません。');

    const fingerprint = projectSourceFingerprint(lead.project);
    const [history, latestConfirmed] = await Promise.all([
      this.prisma.leadAnalysisRevision.findMany({
        where: { leadId },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        take: 20
      }),
      this.prisma.leadAnalysisRevision.findFirst({
        where: {
          leadId,
          projectId: lead.project.id,
          status: 'confirmed',
          sourceFingerprint: fingerprint
        },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }]
      })
    ]);
    return buildAnalysisView(lead.project, history, latestConfirmed);
  }

  save(leadId: string, dto: UpdateLeadAnalysisDto, actor: AuditActor | null = null) {
    return this.append(leadId, dto, false, actor);
  }

  confirm(leadId: string, dto: UpdateLeadAnalysisDto, actor: AuditActor | null = null) {
    return this.append(leadId, dto, true, actor);
  }

  private async append(leadId: string, dto: UpdateLeadAnalysisDto, confirm: boolean, actor: AuditActor | null) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `lead-analysis:${leadId}`);
      const lead = await tx.salesLead.findUnique({ where: { id: leadId }, include: { project: true } });
      if (!lead) throw new NotFoundException('Lead not found');
      if (!lead.project) throw new ConflictException('この営業対象には案件が紐づいていません。');

      const latest = await tx.leadAnalysisRevision.findFirst({
        where: { leadId },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }]
      });
      const currentVersion = latest?.version || 0;
      if (dto.expectedVersion !== currentVersion) {
        throw new ConflictException('分析内容がほかの操作で更新されました。再読み込みしてからやり直してください。');
      }

      const values = normalizeStructuredAnalysis(dto);
      const fingerprint = projectSourceFingerprint(lead.project);
      if (dto.expectedSourceFingerprint !== fingerprint) {
        throw new ConflictException('案件情報が更新されています。分析を再読み込みしてからやり直してください。');
      }
      if (confirm && latest && (latest.projectId !== lead.project.id || latest.sourceFingerprint !== fingerprint)) {
        throw new ConflictException('案件情報が更新されています。分析を保存し直してから確認してください。');
      }
      if (confirm && !isCompleteStructuredAnalysis(values)) {
        throw new ConflictException('商品の魅力・使う人・動画での見せ方をすべて入力してください。');
      }

      const keepsGeneration = Boolean(latest && latest.projectId === lead.project.id && latest.sourceFingerprint === fingerprint);
      const revision = await tx.leadAnalysisRevision.create({
        data: {
          leadId,
          projectId: lead.project.id,
          sourceGenerationId: keepsGeneration ? latest?.sourceGenerationId : null,
          changedById: actor?.userId ?? null,
          version: currentVersion + 1,
          status: confirm ? 'confirmed' : 'draft',
          origin: 'manual',
          ...values,
          sourceFingerprint: fingerprint,
          generatedAt: keepsGeneration ? latest?.generatedAt : null,
          confirmedAt: confirm ? new Date() : null,
          humanEdited: true,
          editedFields: editedAnalysisFields(latest, values)
        }
      });
      if (actor) {
        await tx.auditLog.create({
          data: {
            userId: actor.userId,
            sessionId: actor.sessionId,
            action: confirm ? 'analysis.confirmed' : 'analysis.edited',
            entityType: 'LeadAnalysisRevision',
            entityId: revision.id,
            before: latest ? { version: latest.version, status: latest.status } : undefined,
            after: {
              leadId,
              version: revision.version,
              status: revision.status,
              editedFields: revision.editedFields
            }
          }
        });
      }
    });
    return this.get(leadId);
  }
}

function buildAnalysisView(
  project: { id: string; title: string; url: string; category: string | null; description: string | null },
  history: LeadAnalysisRevision[],
  latestConfirmed: LeadAnalysisRevision | null
) {
  const fingerprint = projectSourceFingerprint(project);
  const proposal = history[0] || null;
  const confirmed = latestConfirmed && isUsableRevision(latestConfirmed, project.id, fingerprint) ? latestConfirmed : null;
  const proposalView = proposal ? toRevisionView(proposal, project.id, fingerprint) : null;
  const confirmedView = confirmed ? toRevisionView(confirmed, project.id, fingerprint) : null;
  return {
    projectId: project.id,
    sourceFingerprint: fingerprint,
    proposal: proposalView,
    confirmed: confirmedView,
    history: history.map((revision) => toRevisionView(revision, project.id, fingerprint)),
    missingFields: missingAnalysisFields(proposal || {}),
    stale: Boolean(proposalView?.stale || (!confirmed && history.some((revision) => revision.status === 'confirmed'))),
    canGenerateMail: Boolean(confirmedView)
  };
}

function isUsableRevision(revision: LeadAnalysisRevision, projectId: string, fingerprint: string) {
  return revision.status === 'confirmed'
    && revision.projectId === projectId
    && revision.sourceFingerprint === fingerprint
    && isCompleteStructuredAnalysis(revision);
}

function toRevisionView(revision: LeadAnalysisRevision, projectId: string, fingerprint: string) {
  return {
    ...revision,
    stale: revision.projectId !== projectId || revision.sourceFingerprint !== fingerprint,
    missingFields: missingAnalysisFields(revision)
  };
}
