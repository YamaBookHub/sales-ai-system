import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateMailDto } from './ai.dto';

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  async generateMailDraft(leadId: string, dto: GenerateMailDto) {
    const lead = await this.prisma.salesLead.findUnique({
      where: { id: leadId },
      include: { company: true, project: true }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const factsUsed = [
      lead.company.name,
      lead.project?.title,
      lead.project?.category
    ].filter((value): value is string => Boolean(value));
    const subject = 'クラウドファンディング支援に関する情報交換のお願い';
    const body = [
      `${lead.company.name}`,
      '',
      'ご担当者様',
      '',
      'お世話になっております。',
      'クラウドファンディング支援およびSNSマーケティング支援をしている、',
      '株式会社第弐ヴォヌールの山本と申します。',
      '',
      '貴社の取り組みを拝見し、クラウドファンディング支援・SNSマーケティング支援の面でお役に立てる可能性を感じ、ご連絡いたしました。',
      '',
      'もしご関心がございましたら、',
      'まずは15〜20分ほど、情報交換のお時間をいただけますと幸いです。',
      '',
      'ご検討のほど、よろしくお願いいたします。'
    ].join('\n');

    const result = await this.prisma.$transaction(async (tx) => {
      const email = await tx.outreachEmail.create({
        data: {
          leadId: lead.id,
          companyId: lead.companyId,
          templateKey: dto.templateKey,
          subject,
          body,
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
          model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
          promptVersion: 'v1',
          inputJson: { leadId, templateKey: dto.templateKey, tone: dto.tone },
          outputJson: { subject, body, factsUsed }
        }
      });

      return { email, aiGeneration };
    });

    return {
      email: result.email,
      aiGenerationId: result.aiGeneration.id,
      factsUsed,
      assumptions: ['MVP placeholder generation. TODO: connect OpenAI client wrapper.'],
      riskFlags: []
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
