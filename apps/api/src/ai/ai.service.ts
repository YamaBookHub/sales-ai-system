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

  async analyzeLead(leadId: string) {
    const lead = await this.prisma.salesLead.findUnique({
      where: { id: leadId },
      include: { company: true, project: true }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const project = lead.project;
    const factsUsed = [
      lead.company.name ? `会社名: ${lead.company.name}` : '',
      project?.title ? `プロジェクト名: ${project.title}` : '',
      project?.category ? `カテゴリ: ${project.category}` : '',
      typeof project?.amount === 'number' ? `支援額: ${project.amount.toLocaleString()}円` : '',
      typeof project?.supporterCount === 'number' ? `支援者数: ${project.supporterCount.toLocaleString()}人` : '',
      lead.reason ? `リード理由: ${lead.reason}` : ''
    ].filter(Boolean);

    const output = {
      summary: buildLocalSummary(lead.company.name, project?.title, project?.category, project?.amount, project?.supporterCount),
      productStrengths: buildLocalStrengths(project?.description, lead.reason),
      targetUsers: buildLocalTargetUsers(project?.category, project?.description),
      salesAngles: buildLocalSalesAngles(project?.amount, project?.supporterCount),
      snsIdeas: buildLocalSnsIdeas(project?.category, project?.description),
      factsUsed,
      assumptions: ['OpenAI APIを使わない無料分析のため、商品説明から読み取れる範囲で整理しています。'],
      riskFlags: ['メール生成前に、会社名・商品名・商品特徴が相手と合っているか確認してください。']
    };

    const aiGeneration = await this.prisma.aiGeneration.create({
      data: {
        leadId: lead.id,
        type: 'project_summary',
        provider: 'local',
        model: 'rule_based_v1',
        promptVersion: 'v1_local_lead_analysis',
        inputJson: {
          leadId,
          companyName: lead.company.name,
          projectTitle: project?.title,
          projectCategory: project?.category,
          projectAmount: project?.amount,
          supporterCount: project?.supporterCount,
          leadReason: lead.reason
        },
        outputJson: output,
        latencyMs: 0
      }
    });

    return { aiGenerationId: aiGeneration.id, output };
  }

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

  async listLeadGenerations(leadId: string) {
    const lead = await this.prisma.salesLead.findUnique({
      where: { id: leadId },
      select: { id: true }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const items = await this.prisma.aiGeneration.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        email: {
          select: {
            id: true,
            subject: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    return { items, total: items.length };
  }
}

function buildLocalSummary(companyName?: string, title?: string | null, category?: string | null, amount?: number | null, supporters?: number | null) {
  const projectText = title ? `「${title}」` : 'CAMPFIRE掲載プロジェクト';
  const categoryText = category ? `${category}領域の` : '';
  const amountText = typeof amount === 'number' && amount > 0 ? `支援額は約${amount.toLocaleString()}円` : '';
  const supporterText = typeof supporters === 'number' && supporters > 0 ? `支援者は${supporters.toLocaleString()}人` : '';
  const metrics = [amountText, supporterText].filter(Boolean).join('、');
  return `${companyName || '対象企業'}の${categoryText}${projectText}を確認しました。${metrics ? `${metrics}で、` : ''}商品特徴と利用シーンを整理したうえで、メール生成前に訴求の方向性を確認します。`;
}

function buildLocalStrengths(description?: string | null, reason?: string | null) {
  const source = [description, reason].filter(Boolean).join(' ');
  const strengths = [
    source.match(/軽量|コンパクト|持ち運び/) ? '持ち運びやすさを伝えやすい可能性があります。' : '',
    source.match(/防災|安全|守/) ? '安心感や備えの必要性を切り口にしやすい可能性があります。' : '',
    source.match(/便利|簡単|時短/) ? '日常の不便を減らす商品として伝えやすい可能性があります。' : ''
  ].filter(Boolean);
  return strengths.length ? strengths : ['商品説明から読み取れる特徴をメール生成前に確認してください。'];
}

function buildLocalTargetUsers(category?: string | null, description?: string | null) {
  const source = `${category || ''} ${description || ''}`;
  if (/防災|安全|守/.test(source)) return ['防災備えを重視する方', '大切な物を保管したい方'];
  if (/アウトドア|キャンプ|旅行/.test(source)) return ['アウトドアや旅行で使う方', '持ち運びやすさを重視する方'];
  if (/美容|ヘルス|健康/.test(source)) return ['日常ケアに関心がある方'];
  return ['商品の利用シーンに近い生活者'];
}

function buildLocalSalesAngles(amount?: number | null, supporters?: number | null) {
  const angles = ['商品の魅力を短く整理し、使用シーンを具体化してメールに反映する。'];
  if (typeof amount === 'number' && amount > 0) angles.push('支援額が確認できるため、一定の関心がある案件として扱う。');
  if (typeof supporters === 'number' && supporters > 0) angles.push('支援者数が確認できるため、利用者に伝わっている点を探す。');
  return angles;
}

function buildLocalSnsIdeas(category?: string | null, description?: string | null) {
  const source = `${category || ''} ${description || ''}`;
  if (/防災|安全|守/.test(source)) return ['使用前後の安心感や、保管シーンを短く見せる。'];
  if (/アウトドア|キャンプ|旅行/.test(source)) return ['屋外や移動中の利用シーンを短く見せる。'];
  return ['実際に使う場面を短く見せ、誰に役立つかを分かりやすくする。'];
}
