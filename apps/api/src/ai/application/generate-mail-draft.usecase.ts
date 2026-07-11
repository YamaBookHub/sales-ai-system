import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GenerateMailDto } from '../ai.dto';
import { buildLocalMailDraft, buildLocalMailInput } from '../domain/local-mail-draft';

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

    const aiInput = buildLocalMailInput(lead, dto);
    const draft = buildLocalMailDraft(aiInput);

    const result = await this.prisma.$transaction(async (tx) => {
      const email = await tx.outreachEmail.create({
        data: {
          leadId: lead.id,
          companyId: lead.companyId,
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

