import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesMailDraftInput } from '../domain/openai-sales-mail-draft';
import { OpenAiClientService } from '../openai-client.service';

@Injectable()
export class PolishMailUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openAi: OpenAiClientService
  ) {}

  async execute(mailId: string) {
    const email = await this.prisma.outreachEmail.findUnique({
      where: { id: mailId },
      include: {
        lead: { include: { company: true, project: { include: { platform: true } } } }
      }
    });

    if (!email || !email.lead) {
      throw new NotFoundException('Mail not found');
    }

    if (!['draft', 'rejected'].includes(email.status)) {
      throw new ConflictException('AIで整えられるのは下書きまたは棄却後のメールだけです。');
    }

    const lead = email.lead;
    const aiInput = toSalesMailDraftInput(lead, {
      templateKey: email.templateKey || 'normal',
      tone: 'low_sales_pressure'
    });
    const draft = await this.openAi.createSalesMailDraft(aiInput);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedEmail = await tx.outreachEmail.update({
        where: { id: email.id },
        data: {
          subject: draft.subject,
          body: draft.body,
          status: 'draft',
          failedReason: null,
          events: { create: { type: 'generated', payload: { source: 'openai_polish' } } }
        }
      });

      const aiGeneration = await tx.aiGeneration.create({
        data: {
          leadId: lead.id,
          emailId: updatedEmail.id,
          type: 'email_draft',
          provider: 'openai',
          model: draft.model,
          promptVersion: 'v2_openai_sales_mail_polish',
          inputJson: { leadId: lead.id, mailId, ...aiInput },
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

      return { email: updatedEmail, aiGeneration };
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

function toSalesMailDraftInput(
  lead: {
    reason?: string | null;
    brandAnalysisMemo?: string | null;
    snsAnalysisMemo?: string | null;
    company: { name: string };
    project?: {
      title?: string | null;
      platform?: { name?: string | null; type?: string | null } | null;
      url?: string | null;
      category?: string | null;
      description?: string | null;
      amount?: number | null;
      supporterCount?: number | null;
    } | null;
  },
  input: { templateKey: string; tone?: string }
): SalesMailDraftInput {
  return {
    templateKey: input.templateKey,
    tone: input.tone,
    companyName: lead.company.name,
    projectTitle: lead.project?.title,
    projectPlatformName: projectPlatformLabel(lead.project),
    projectUrl: lead.project?.url,
    projectCategory: lead.project?.category,
    projectDescription: compatibleAnalysisMemo(lead.project?.description, [lead.project?.title, lead.project?.category].filter(Boolean).join(' ')),
    projectAmount: lead.project?.amount,
    supporterCount: lead.project?.supporterCount,
    leadReason: lead.reason,
    brandAnalysisMemo: lead.brandAnalysisMemo,
    snsAnalysisMemo: lead.snsAnalysisMemo
  };
}

function projectPlatformLabel(project?: { platform?: { name?: string | null; type?: string | null } | null; url?: string | null } | null) {
  if (project?.platform?.name) return project.platform.name;
  const type = project?.platform?.type;
  if (type) {
    return (
      {
        campfire: 'CAMPFIRE',
        makuake: 'Makuake',
        green_funding: 'GREEN FUNDING',
        other: 'クラウドファンディングサイト'
      } as Record<string, string>
    )[type] || type;
  }
  const url = project?.url || '';
  if (url.includes('camp-fire.jp')) return 'CAMPFIRE';
  if (url.includes('makuake.com')) return 'Makuake';
  if (url.includes('greenfunding.jp')) return 'GREEN FUNDING';
  return 'クラウドファンディングサイト';
}

function compatibleAnalysisMemo(memo?: string | null, projectSource = '') {
  const cleaned = sanitizeAnalysisSource(memo || '');
  if (!cleaned) return '';
  return isPhraseCompatibleWithProject(cleaned, projectSource) ? cleaned : '';
}

function sanitizeAnalysisSource(value: string) {
  return value
    .replace(/達成率\s*[:：]?\s*[0-9,]+%?/g, '')
    .replace(/残り日数\s*[:：]?\s*[0-9,]+日?/g, '')
    .replace(/支援額\s*[:：]?\s*[0-9,]+円?/g, '')
    .replace(/支援者数\s*[:：]?\s*[0-9,]+人?/g, '')
    .replace(/(?:特別価格|限定価格|早割|割引|[0-9,]+円(?:税込)?|価格でご提供|ご提供)/g, '')
    .replace(/特徴\s*[:：]?\s*カテゴリーからさがす/g, '')
    .replace(/カテゴリーからさがす/g, '')
    .replace(/商品説明から読み取れる特徴をメール生成前に確認してください。?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPhraseCompatibleWithProject(phrase: string, projectSource: string) {
  if (!phrase || !projectSource) return true;
  const rules = [
    { pattern: /米びつ|米櫃|お米|キッチン|真空保存|鮮度|保存容器|収納/, required: /米びつ|米櫃|お米|キッチン|真空保存|鮮度|保存容器|収納/ },
    { pattern: /サーモン|スモークサーモン|ハム|肉|魚|海鮮|食品|グルメ|料理|食卓|味|香り|燻製|伏流水/, required: /サーモン|スモークサーモン|ハム|肉|魚|海鮮|食品|グルメ|料理|食卓|味|香り|燻製|伏流水/ },
    { pattern: /エアベッド|寝心地|車中泊|キャンプ|アウトドア|来客|寝具/, required: /エアベッド|ベッド|寝心地|車中泊|キャンプ|アウトドア|来客|寝具/ },
    { pattern: /ライブ|コンサート|ファン|音楽|バンド|周年|公演/, required: /ライブ|コンサート|ファン|音楽|バンド|周年|公演/ },
    { pattern: /焼き鳥|焼鳥|炭火|店舗|飲食|居酒屋|リフォーム|改装/, required: /焼き鳥|焼鳥|炭火|店舗|飲食|居酒屋|リフォーム|改装/ }
  ];
  return rules.every((rule) => !rule.pattern.test(phrase) || rule.required.test(projectSource));
}
