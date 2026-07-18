import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GenerateMailDto } from '../ai.dto';
import { buildLocalMailDraft, buildLocalMailInput } from '../domain/local-mail-draft';
import { resolveMailRecipient } from '../../mail/infrastructure/contact-recipient.resolver';
import { assertLeadContactEligible } from '../../mail/infrastructure/contact-eligibility.reader';

@Injectable()
export class GenerateMailDraftUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(leadId: string, dto: GenerateMailDto) {
    const lead = await this.prisma.salesLead.findUnique({
      where: { id: leadId },
      include: { company: true, project: { include: { platform: true } } }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const existingMail = await this.prisma.outreachEmail.findFirst({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true }
    });

    if (existingMail) {
      throw new ConflictException('この営業対象には既存メールがあります。履歴からメールを選択して編集・レビューしてください。');
    }

    const template = await this.prisma.mailTemplate.findUnique({ where: { key: dto.templateKey } });
    const activeTemplate = template?.isActive
      ? { key: template.key, subject: template.subject, body: template.body }
      : undefined;
    const aiInput = buildLocalMailInput(lead, dto, activeTemplate);
    const draft = buildLocalMailDraft(aiInput);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        `mail-draft:${lead.id}`
      );
      const recipient = await resolveMailRecipient(tx, lead.companyId);
      const destination = await assertLeadContactEligible(tx, lead, recipient, { lock: true });
      const concurrentMail = await tx.outreachEmail.findFirst({
        where: { leadId: lead.id },
        select: { id: true }
      });
      if (concurrentMail) {
        throw new ConflictException('この営業対象には既存メールがあります。履歴からメールを選択して編集・レビューしてください。');
      }
      const email = await tx.outreachEmail.create({
        data: {
          leadId: lead.id,
          companyId: lead.companyId,
          contactId: recipient?.id,
          toEmail: recipient?.email,
          destinationType: destination?.type,
          destinationValue: destination?.value,
          destinationKey: destination?.key,
          templateKey: dto.templateKey,
          subject: draft.subject,
          body: draft.body,
          status: 'draft',
          events: { create: { type: 'generated' } }
        }
      });
      await tx.salesLead.update({
        where: { id: lead.id },
        data: { status: 'drafted' }
      });
      const aiGeneration = await tx.aiGeneration.create({
        data: {
          leadId: lead.id,
          emailId: email.id,
          type: 'email_draft',
          provider: 'local',
          model: draft.model,
          promptVersion: 'v2_local_sales_mail',
          inputJson: { leadId, ...aiInput },
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

      return { email, aiGeneration };
    });

    return {
      email: result.email,
      aiGenerationId: result.aiGeneration.id,
      factsUsed: draft.factsUsed,
      assumptions: draft.assumptions,
      riskFlags: draft.riskFlags
    };
  }
}
