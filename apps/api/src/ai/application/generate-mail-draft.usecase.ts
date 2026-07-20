import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuditActor } from '../../audit/audit-actor';
import { resolveMailRecipient } from '../../mail/infrastructure/contact-recipient.resolver';
import { assertLeadContactEligible } from '../../mail/infrastructure/contact-eligibility.reader';
import { GenerateMailDto } from '../ai.dto';
import { normalizeStructuredAnalysis } from '../domain/lead-analysis';
import { buildLocalMailDraft, buildLocalMailInput } from '../domain/local-mail-draft';
import { requireLatestConfirmedAnalysis } from './confirmed-analysis.reader';

@Injectable()
export class GenerateMailDraftUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(leadId: string, dto: GenerateMailDto, actor: AuditActor) {
    const organizationId = actor.organizationId;
    const leadExists = await this.prisma.salesLead.findFirst({ where: { id: leadId, organizationId }, select: { id: true } });
    if (!leadExists) throw new NotFoundException('Lead not found');

    const existingMail = await this.prisma.outreachEmail.findFirst({
      where: { organizationId, leadId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true }
    });
    if (existingMail) {
      throw new ConflictException('この営業対象には既存メールがあります。履歴からメールを選択して編集・レビューしてください。');
    }

    const template = await this.prisma.mailTemplate.findFirst({ where: { organizationId, key: dto.templateKey } });
    const activeTemplate = template?.isActive
      ? { key: template.key, subject: template.subject, body: template.body }
      : undefined;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `mail-draft:${organizationId}:${leadId}`);
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `lead-analysis:${organizationId}:${leadId}`);
      const lead = await tx.salesLead.findFirst({
        where: { id: leadId, organizationId },
        include: { company: true, project: { include: { platform: true } } }
      });
      if (!lead) throw new NotFoundException('Lead not found');
      if (!lead.project) throw new ConflictException('この営業対象には案件が紐づいていません。');

      const analysisRevision = await requireLatestConfirmedAnalysis(tx, lead, dto.analysisRevisionId);

      const analysis = normalizeStructuredAnalysis(analysisRevision);
      const aiInput = buildLocalMailInput(lead, dto, activeTemplate, analysis);
      const draft = buildLocalMailDraft(aiInput);
      const recipient = await resolveMailRecipient(tx, lead.companyId, organizationId);
      const destination = await assertLeadContactEligible(tx, lead, recipient, { lock: true });
      const concurrentMail = await tx.outreachEmail.findFirst({ where: { organizationId, leadId }, select: { id: true } });
      if (concurrentMail) {
        throw new ConflictException('この営業対象には既存メールがあります。履歴からメールを選択して編集・レビューしてください。');
      }

      const email = await tx.outreachEmail.create({
        data: {
          organizationId,
          leadId,
          companyId: lead.companyId,
          contactId: recipient?.id,
          analysisRevisionId: analysisRevision.id,
          toEmail: recipient?.email,
          destinationType: destination?.type,
          destinationValue: destination?.value,
          destinationKey: destination?.key,
          templateKey: dto.templateKey,
          subject: draft.subject,
          body: draft.body,
          status: 'draft',
          // 親メールの組織IDをネスト作成するイベントへ自動伝播させる。
          events: { create: { type: 'generated', payload: { actorUserId: actor.userId } } }
        }
      });
      await tx.salesLead.update({ where: { organizationId_id: { organizationId, id: leadId } }, data: { status: 'drafted' } });
      const aiGeneration = await tx.aiGeneration.create({
        data: {
          organizationId,
          leadId,
          emailId: email.id,
          type: 'email_draft',
          provider: 'local',
          model: draft.model,
          promptVersion: 'v3_confirmed_structured_analysis',
          inputJson: { leadId, analysisRevisionId: analysisRevision.id, ...aiInput },
          outputJson: {
            subject: draft.subject,
            body: draft.body,
            factsUsed: draft.factsUsed,
            assumptions: draft.assumptions,
            riskFlags: draft.riskFlags
          },
          latencyMs: draft.latencyMs,
          tokenInput: 0,
          tokenOutput: 0,
          costUsd: 0
        }
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actor.userId,
          sessionId: actor.sessionId,
          action: 'mail.generated',
          entityType: 'OutreachEmail',
          entityId: email.id,
          after: {
            leadId,
            analysisRevisionId: analysisRevision.id,
            templateKey: dto.templateKey,
            model: draft.model
          }
        }
      });
      return { email, aiGeneration, draft };
    });

    return {
      email: result.email,
      aiGenerationId: result.aiGeneration.id,
      factsUsed: result.draft.factsUsed,
      assumptions: result.draft.assumptions,
      riskFlags: result.draft.riskFlags
    };
  }
}
