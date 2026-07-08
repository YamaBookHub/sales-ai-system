import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateMailDto } from './ai.dto';
import { OpenAiClientService } from './openai-client.service';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openAi: OpenAiClientService
  ) {}

  async generateMailDraft(leadId: string, dto: GenerateMailDto) {
    const lead = await this.prisma.salesLead.findUnique({
      where: { id: leadId },
      include: { company: true, project: true }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const aiInput = {
      templateKey: dto.templateKey,
      tone: dto.tone,
      companyName: lead.company.name,
      projectTitle: lead.project?.title,
      projectUrl: lead.project?.url,
      projectCategory: lead.project?.category,
      projectDescription: lead.project?.description,
      projectAmount: lead.project?.amount,
      supporterCount: lead.project?.supporterCount,
      leadReason: lead.reason
    };
    const draft = await this.openAi.createSalesMailDraft(aiInput);

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
      const aiGeneration = await tx.aiGeneration.create({
        data: {
          leadId: lead.id,
          emailId: email.id,
          type: 'email_draft',
          provider: 'openai',
          model: draft.model,
          promptVersion: 'v2_openai_sales_mail',
          inputJson: { leadId, ...aiInput },
          outputJson: {
            subject: draft.subject,
            body: draft.body,
            factsUsed: draft.factsUsed,
            assumptions: draft.assumptions,
            riskFlags: draft.riskFlags
          },
          latencyMs: draft.latencyMs,
          tokenInput: draft.usage.inputTokens,
          tokenOutput: draft.usage.outputTokens,
          costUsd: draft.usage.costUsd
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

  async classifyReply(replyId: string) {
    const reply = await this.prisma.emailReply.findUnique({ where: { id: replyId } });

    if (!reply) {
      throw new NotFoundException('Reply not found');
    }

    return this.prisma.emailReply.update({
      where: { id: replyId },
      data: {
        category: 'unknown',
        confidence: 0,
        summary: 'TODO: AI reply classification is not connected yet.'
      }
    });
  }
}
