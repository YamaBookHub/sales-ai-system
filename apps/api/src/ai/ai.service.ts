import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadStatus, ReplyCategory } from '@prisma/client';
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
      readiness: buildMailReadiness(lead, project),
      missingInfo: buildMissingInfo(lead, project),
      nextChecks: buildNextChecks(lead, project),
      mailAdvice: buildMailAdvice(project?.category, project?.description, lead.reason),
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

    const existingMail = await this.prisma.outreachEmail.findFirst({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true }
    });

    if (existingMail) {
      throw new ConflictException('この営業対象には既存メールがあります。履歴からメールを選択して編集・レビューしてください。');
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
      await tx.salesLead.update({
        where: { id: lead.id },
        data: { status: 'drafted' }
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
    const reply = await this.prisma.emailReply.findUnique({
      where: { id: replyId },
      include: { email: true }
    });

    if (!reply) {
      throw new NotFoundException('Reply not found');
    }

    const classification = classifyReplyText(reply.bodyText || reply.body);

    return this.prisma.$transaction(async (tx) => {
      const updatedReply = await tx.emailReply.update({
        where: { id: replyId },
        data: {
          category: classification.category,
          confidence: classification.confidence,
          summary: classification.summary,
          nextAction: classification.nextAction
        }
      });

      if (reply.email.leadId) {
        await tx.salesLead.update({
          where: { id: reply.email.leadId },
          data: {
            status: classification.leadStatus,
            nextActionAt: classification.nextActionAt
          }
        });
      }

      return { reply: updatedReply, classification };
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

function classifyReplyText(body: string): {
  category: ReplyCategory;
  confidence: number;
  summary: string;
  nextAction: string;
  leadStatus: LeadStatus;
  nextActionAt?: Date;
} {
  const text = body.replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  if (/配信停止|停止|不要|unsubscribe|今後.*不要/.test(lower)) {
    return {
      category: 'unsubscribe',
      confidence: 0.9,
      summary: '配信停止または今後不要の返信です。',
      nextAction: '対象外にし、以後の連絡を止める。',
      leadStatus: 'rejected'
    };
  }

  if (/打ち合わせ|商談|面談|日程|候補日|zoom|ミーティング|meeting/.test(lower)) {
    return {
      category: 'meeting_request',
      confidence: 0.86,
      summary: '面談または日程調整につながる返信です。',
      nextAction: '日程候補または調整リンクを送る。',
      leadStatus: 'meeting_candidate',
      nextActionAt: tomorrow
    };
  }

  if (/資料|詳しく|詳細|料金|費用|教えて|知りたい|興味|検討/.test(lower)) {
    return {
      category: 'need_info',
      confidence: 0.78,
      summary: '追加情報や資料を求めている可能性があります。',
      nextAction: '質問に回答し、必要なら資料や説明を送る。',
      leadStatus: 'replied',
      nextActionAt: tomorrow
    };
  }

  if (/興味ありません|不要です|結構です|お断り|予算.*ない|時期.*違/.test(lower)) {
    return {
      category: 'not_interested',
      confidence: 0.82,
      summary: '現時点では見送りまたは不要の返信です。',
      nextAction: '無理に追わず、必要なら時期を空けて再確認する。',
      leadStatus: 'no_response'
    };
  }

  if (/自動返信|不在|休暇|auto.?reply|out of office/.test(lower)) {
    return {
      category: 'auto_reply',
      confidence: 0.88,
      summary: '自動返信の可能性があります。',
      nextAction: '通常返信を待ち、必要なら数日後に確認する。',
      leadStatus: 'contacted',
      nextActionAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    };
  }

  return {
    category: 'unknown',
    confidence: 0.4,
    summary: text.slice(0, 120) || '返信内容を確認してください。',
    nextAction: '返信内容を確認し、次対応を判断する。',
    leadStatus: 'replied',
    nextActionAt: tomorrow
  };
}

function buildLocalStrengths(description?: string | null, reason?: string | null) {
  const source = [description, reason].filter(Boolean).join(' ');
  const strengths = [
    source.match(/飲食|焼き鳥|焼鳥|炭火|居酒屋|レストラン|店舗|リフォーム|改装|創業/) ? '店舗の継続や改装の背景を、応援したくなる取り組みとして伝えやすい可能性があります。' : '',
    source.match(/軽量|コンパクト|持ち運び/) ? '持ち運びやすさを伝えやすい可能性があります。' : '',
    source.match(/防災|安全|守/) ? '安心感や備えの必要性を切り口にしやすい可能性があります。' : '',
    source.match(/便利|簡単|時短/) ? '日常の不便を減らす商品として伝えやすい可能性があります。' : ''
  ].filter(Boolean);
  return strengths.length ? strengths : ['商品説明から読み取れる特徴をメール生成前に確認してください。'];
}

function buildLocalTargetUsers(category?: string | null, description?: string | null) {
  const source = `${category || ''} ${description || ''}`;
  if (/飲食|焼き鳥|焼鳥|炭火|居酒屋|レストラン|店舗|リフォーム|改装|創業/.test(source)) return ['地域に根ざした店舗を応援したい方', '飲食店の継続や再開を応援したい方'];
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
  if (/飲食|焼き鳥|焼鳥|炭火|居酒屋|レストラン|店舗|リフォーム|改装|創業/.test(source)) return ['店舗の歴史、改装の背景、料理や店内の雰囲気を短く見せる。'];
  if (/防災|安全|守/.test(source)) return ['使用前後の安心感や、保管シーンを短く見せる。'];
  if (/アウトドア|キャンプ|旅行/.test(source)) return ['屋外や移動中の利用シーンを短く見せる。'];
  return ['実際に使う場面を短く見せ、誰に役立つかを分かりやすくする。'];
}

function buildMailReadiness(
  lead: {
    contactEmail?: string | null;
    contactFormUrl?: string | null;
    siteMessageUrl?: string | null;
    reason?: string | null;
    company: { name?: string | null };
  },
  project?: { title?: string | null; description?: string | null; amount?: number | null; supporterCount?: number | null } | null
) {
  const missing = buildMissingInfo(lead, project);
  const missingCount = missing[0] === '大きな不足はありません。' ? 0 : missing.length;
  const hasContact = Boolean(lead.contactEmail || lead.contactFormUrl || lead.siteMessageUrl);
  let score = 100 - missingCount * 12;
  if (!hasContact) score -= 18;
  if (!lead.reason) score -= 8;
  if (typeof project?.amount === 'number' && project.amount > 0) score += 5;
  if (typeof project?.supporterCount === 'number' && project.supporterCount > 0) score += 5;
  score = Math.max(0, Math.min(100, score));

  const label = score >= 80 ? 'メール生成に進めます' : score >= 55 ? '確認後にメール生成' : '先に情報確認';
  const reason = hasContact
    ? '連絡先候補があるため、内容確認後にメール生成へ進めます。'
    : '連絡先が未確認のため、メール生成前に問い合わせフォームまたはサイト内メッセージ先を確認してください。';

  return { score, label, reason };
}

function buildMissingInfo(
  lead: {
    contactEmail?: string | null;
    contactFormUrl?: string | null;
    siteMessageUrl?: string | null;
    company: { name?: string | null };
  },
  project?: { title?: string | null; description?: string | null } | null
) {
  const missing = [
    lead.company.name ? '' : '企業名',
    project?.title ? '' : '商品名',
    project?.description ? '' : '商品説明',
    lead.contactEmail || lead.contactFormUrl || lead.siteMessageUrl ? '' : '連絡先'
  ].filter(Boolean);
  return missing.length ? missing : ['大きな不足はありません。'];
}

function buildNextChecks(
  lead: {
    contactEmail?: string | null;
    contactFormUrl?: string | null;
    siteMessageUrl?: string | null;
    brandWebsiteUrl?: string | null;
    instagramUrl?: string | null;
    tiktokUrl?: string | null;
    xUrl?: string | null;
  },
  project?: { url?: string | null; description?: string | null } | null
) {
  const checks = [
    '会社名と商品名がCAMPFIREページと一致しているか確認する。',
    project?.description ? '商品特徴がメール本文に入れて問題ない表現か確認する。' : '商品特徴をCAMPFIREページから手動で補足する。',
    lead.contactEmail || lead.contactFormUrl || lead.siteMessageUrl ? '送信先がメール・フォーム・サイト内メッセージのどれか確認する。' : '送信先メール、問い合わせフォーム、サイト内メッセージの有無を確認する。'
  ];
  if (lead.brandWebsiteUrl || lead.instagramUrl || lead.tiktokUrl || lead.xUrl) {
    checks.push('公式サイトやSNSの見せ方を確認し、メール内で触れるべきか判断する。');
  }
  if (project?.url) checks.push('CAMPFIREページを開き、終了日や公開状態が変わっていないか確認する。');
  return checks;
}

function buildMailAdvice(category?: string | null, description?: string | null, reason?: string | null) {
  const source = `${category || ''} ${description || ''} ${reason || ''}`;
  if (/飲食|焼き鳥|焼鳥|炭火|居酒屋|レストラン|店舗|リフォーム|改装|創業/.test(source)) {
    return ['商品として断定せず、店舗の継続や改装背景に共感した文章にする。', '来店者や地域の支援者に伝わる見せ方の相談として書く。'];
  }
  if (/防災|安全|守/.test(source)) {
    return ['不安を煽りすぎず、「備え」「安心」「保管シーン」を中心に書く。', '成果保証ではなく、商品の魅力を伝える見せ方の相談として書く。'];
  }
  if (/アウトドア|キャンプ|旅行/.test(source)) {
    return ['使用シーンが想像しやすい点を中心に書く。', '持ち運びや便利さを断定しすぎず、実際の利用場面に寄せる。'];
  }
  return ['商品特徴を1つに絞り、営業感を弱めて書く。', '課題を断定せず、「お力になれそうな機会があれば」という柔らかい表現にする。'];
}
