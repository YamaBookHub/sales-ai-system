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
      include: { company: true, project: { include: { platform: true } } }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const project = lead.project;
    const safeProjectDescription = compatibleAnalysisMemo(project?.description, [project?.title, project?.category].filter(Boolean).join(' '));
    const projectAnalysisSource = [project?.title, safeProjectDescription, project?.category, lead.reason]
      .filter(Boolean)
      .join(' ');
    const safeBrandAnalysisMemo = compatibleAnalysisMemo(lead.brandAnalysisMemo, projectAnalysisSource);
    const safeSnsAnalysisMemo = compatibleAnalysisMemo(lead.snsAnalysisMemo, projectAnalysisSource);
    const analysisSource = [projectAnalysisSource, safeBrandAnalysisMemo, safeSnsAnalysisMemo]
      .filter(Boolean)
      .join(' ');
    const factsUsed = [
      lead.company.name ? `会社名: ${lead.company.name}` : '',
      projectPlatformLabel(project) ? `取得元: ${projectPlatformLabel(project)}` : '',
      project?.title ? `プロジェクト名: ${project.title}` : '',
      project?.category ? `カテゴリ: ${project.category}` : '',
      typeof project?.amount === 'number' ? `支援額: ${project.amount.toLocaleString()}円` : '',
      typeof project?.supporterCount === 'number' ? `支援者数: ${project.supporterCount.toLocaleString()}人` : '',
      lead.reason ? `リード理由: ${lead.reason}` : '',
      safeBrandAnalysisMemo ? `ブランド分析メモ: ${safeBrandAnalysisMemo}` : '',
      safeSnsAnalysisMemo ? `SNS分析メモ: ${safeSnsAnalysisMemo}` : ''
    ].filter(Boolean);

    const output = {
      summary: buildLocalSummary(lead.company.name, project?.title, project?.category, project?.amount, project?.supporterCount),
      productStrengths: buildLocalStrengths(projectAnalysisSource, lead.reason),
      targetUsers: buildLocalTargetUsers(project?.category, projectAnalysisSource),
      salesAngles: buildLocalSalesAngles(project?.amount, project?.supporterCount),
      snsIdeas: buildLocalSnsIdeas(project?.category, projectAnalysisSource),
      readiness: buildMailReadiness(lead, project),
      missingInfo: buildMissingInfo(lead, project),
      nextChecks: buildNextChecks(lead, project),
      mailAdvice: buildMailAdvice(project?.category, analysisSource, lead.reason),
      mailPlaceholders: buildMailPlaceholders(
        lead.company.name,
        project?.title,
        project?.category,
      safeProjectDescription,
        lead.reason,
        safeBrandAnalysisMemo,
        safeSnsAnalysisMemo
      ),
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
          leadReason: lead.reason,
          brandAnalysisMemo: safeBrandAnalysisMemo,
          snsAnalysisMemo: safeSnsAnalysisMemo
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

    const aiInput = buildMailInput(lead, dto);
    const draft = buildFreeMailDraft(aiInput);

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

  async polishMail(mailId: string) {
    const email = await this.prisma.outreachEmail.findUnique({
      where: { id: mailId },
      include: {
        lead: { include: { company: true, project: { include: { platform: true } } } }
      }
    });

    if (!email || !email.lead) {
      throw new NotFoundException('Mail not found');
    }
    const lead = email.lead;

    if (!['draft', 'rejected'].includes(email.status)) {
      throw new ConflictException('AIで整えられるのは下書きまたは棄却後のメールだけです。');
    }

    const aiInput = buildMailInput(lead, {
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

type MailInput = {
  templateKey: string;
  tone?: string;
  companyName: string;
  projectTitle?: string | null;
  projectPlatformName?: string | null;
  projectUrl?: string | null;
  projectCategory?: string | null;
  projectDescription?: string | null;
  projectAmount?: number | null;
  supporterCount?: number | null;
  leadReason?: string | null;
  brandAnalysisMemo?: string | null;
  snsAnalysisMemo?: string | null;
};

function buildMailInput(
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
  dto: GenerateMailDto
): MailInput {
  return {
    templateKey: dto.templateKey,
    tone: dto.tone,
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

function buildFreeMailDraft(input: MailInput) {
  const platformName = input.projectPlatformName || 'クラウドファンディングサイト';
  const placeholders = buildMailPlaceholders(
    input.companyName,
    input.projectTitle,
    input.projectCategory,
    input.projectDescription,
    input.leadReason,
    input.brandAnalysisMemo,
    input.snsAnalysisMemo
  );
  const subjectNoun = placeholders.subjectType === '取り組み' ? 'プロジェクト' : '商品';
  const body = [
    `${placeholders.companyRecipient}`,
    '',
    'お世話になっております。',
    '株式会社第弐ヴォヌールの山本と申します。',
    '',
    `${platformName}にて、貴社の「${placeholders.productName}」を拝見しました。`,
    '',
    `${placeholders.appeal}がとても印象的で、`,
    `${placeholders.targetUser}にとって、実際の${placeholders.subjectType}の魅力をイメージしやすい内容だと感じました。`,
    '',
    '弊社では、クラウドファンディング支援およびSNSマーケティング支援を行っております。',
    '',
    '実績としては、SNS運用で1か月総再生400万回超、',
    'クラウドファンディング領域では、担当商品で3,500万円規模の売上実績がございます。',
    '',
    `${subjectNoun}の魅力を伝える見せ方や、売上につながる導線づくりの面でもお手伝いしております。`,
    '',
    'もし何かお力になれそうな機会がございましたら、',
    'お気軽にご連絡いただけますと幸いです。'
  ].join('\n');

  return {
    subject: `${platformName}でのプロジェクトを拝見しご連絡いたしました`,
    body,
    factsUsed: [
      `会社名: ${input.companyName}`,
      `取得元: ${platformName}`,
      `プロジェクト名: ${placeholders.productName}`,
      `魅力: ${placeholders.appeal}`,
      `想定読者: ${placeholders.targetUser}`,
      input.brandAnalysisMemo ? `ブランド分析メモ: ${input.brandAnalysisMemo}` : '',
      input.snsAnalysisMemo ? `SNS分析メモ: ${input.snsAnalysisMemo}` : ''
    ].filter(Boolean),
    assumptions: ['OpenAI APIを使わず、無料分析で作成した置換項目から本文を作成しています。'],
    riskFlags: ['送信前に、会社名・商品名・商品の魅力が相手の案件と合っているか確認してください。'],
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
    model: 'local-template-v2',
    latencyMs: 0,
    rawOutput: { placeholders }
  };
}

function buildLocalSummary(companyName?: string, title?: string | null, category?: string | null, amount?: number | null, supporters?: number | null) {
  const projectText = title ? `「${title}」` : 'クラウドファンディング掲載プロジェクト';
  const categoryText = category ? `${category}領域の` : '';
  const amountText = typeof amount === 'number' && amount > 0 ? `支援額は約${amount.toLocaleString()}円` : '';
  const supporterText = typeof supporters === 'number' && supporters > 0 ? `支援者は${supporters.toLocaleString()}人` : '';
  const metrics = [amountText, supporterText].filter(Boolean).join('、');
  return `${companyName || '対象企業'}の${categoryText}${projectText}を確認しました。${metrics ? `${metrics}で、` : ''}商品特徴と利用シーンを整理したうえで、メール生成前に訴求の方向性を確認します。`;
}

function buildMailPlaceholders(
  companyName?: string | null,
  title?: string | null,
  category?: string | null,
  description?: string | null,
  reason?: string | null,
  brandAnalysisMemo?: string | null,
  snsAnalysisMemo?: string | null
) {
  const manualAnalysis = sanitizeAnalysisSource(`${brandAnalysisMemo || ''} ${snsAnalysisMemo || ''}`);
  const titleCategorySource = sanitizeAnalysisSource(`${title || ''} ${category || ''}`);
  const safeDescription = compatibleAnalysisMemo(description, titleCategorySource);
  const projectSource = sanitizeAnalysisSource(`${titleCategorySource} ${safeDescription || ''}`);
  const source = sanitizeAnalysisSource(`${projectSource} ${reason || ''} ${manualAnalysis}`);
  const isStoreProject = /飲食|焼き鳥|焼鳥|炭火|居酒屋|レストラン|店舗|リフォーム|改装|創業|地域/.test(projectSource);
  const isEventProject = /ライブ|コンサート|音楽|バンド|ファン|周年|結成|記念|イベント|公演|ツアー|フェス|アーティスト/.test(projectSource);
  const isFoodProject = /サーモン|スモークサーモン|ハム|肉|魚|海鮮|食品|グルメ|料理|食卓|味|香り|燻製|伏流水/.test(projectSource);
  const isRiceStorageProject = /米びつ|米櫃|真空保存|鮮度|キッチン|分割保存|保存容器|収納|お米/.test(projectSource);
  const isAirBedProject = /エアベッド|ベッド|寝られる|寝心地|空気|マットレス|キャンプ|車中泊|アウトドア/.test(projectSource);
  const strength = buildLocalStrengths(safeDescription, [reason, manualAnalysis].filter(Boolean).join(' '))[0] || '';
  const manualAppeal = pickManualAppeal(manualAnalysis, projectSource);
  const manualTarget = pickManualTarget(manualAnalysis, projectSource);
  const specificAppeal = buildSpecificAppeal(projectSource);
  const appeal = ensureCompatibleAppeal(manualAppeal || (isStoreProject
    ? '長年親しまれてきた店舗をより利用しやすい形で継続しようとされている点'
    : isEventProject
      ? '節目となる企画をファンの方々と一緒に盛り上げようとされている点'
      : isFoodProject
        ? specificAppeal || '素材の魅力や職人技が伝わりやすく、味わいを想像しやすい点'
      : isRiceStorageProject
        ? 'お米の鮮度を保ちながら、キッチンに収まりやすい形で分けて保存できる点'
      : isAirBedProject
          ? specificAppeal || '屋内外で使いやすく、寝心地や持ち運びやすさを訴求しやすい点'
      : specificAppeal || toMailSafeAppeal(strength, title)), projectSource);
  const target = manualTarget || (isStoreProject
    ? '店舗の継続や地域に根ざしたお店を応援したい方'
    : isEventProject
      ? 'これまで活動を応援してきたファンの方や、ライブ体験に関心のある方'
      : isFoodProject
        ? '食の品質や特別な味わいを楽しみたい方'
      : isRiceStorageProject
        ? 'お米の保存状態やキッチン収納を重視する方'
        : isAirBedProject
          ? 'キャンプや車中泊、来客時の寝具を手軽に用意したい方'
      : buildLocalTargetUsers(category, safeDescription)[0] || 'この取り組みに関心を持つ方');
  const subjectType = isStoreProject || isEventProject ? '取り組み' : '商品';

  return {
    companyRecipient: companyName ? `${companyName} ご担当者様` : 'ご担当者様',
    productName: cleanProjectTitleForMail(title) || 'クラウドファンディング掲載プロジェクト',
    appeal,
    targetUser: target,
    subjectType,
    caution: '達成率、残り日数、支援額、支援者数、カテゴリ名は魅力文には入れません。'
  };
}

function buildSpecificAppeal(projectSource: string) {
  const source = sanitizeAnalysisSource(projectSource);
  const patterns = [
    { pattern: /スモークサーモン|サーモン|大山ハム|職人技|伏流水|燻製|味わい|食卓/g, suffix: '素材や味わいの魅力を想像しやすい点' },
    { pattern: /有田焼|醤油差し|サイフォン|残量|NEO CLAY|食卓|デザイン/g, suffix: '機能性と見た目の特徴が伝わりやすい点' },
    { pattern: /エアベッド|AeroCloud|寝心地|揺れず|丈夫|キャンプ|車中泊|来客/g, suffix: '実際の利用シーンを想像しやすい点' },
    { pattern: /真空保存|鮮度|分割保存|米びつ|保存容器|キッチン|収納/g, suffix: '使いやすさや保管シーンを想像しやすい点' },
    { pattern: /ライブ|ファン|周年|記念|音楽|公演|イベント/g, suffix: '参加する理由や応援する背景が伝わりやすい点' },
    { pattern: /リフォーム|改装|創業|店舗|地域|飲食|焼き鳥|炭火/g, suffix: '応援したくなる背景が伝わりやすい点' }
  ];
  for (const { pattern, suffix } of patterns) {
    const matches = Array.from(new Set(source.match(pattern) || [])).slice(0, 3);
    if (matches.length) return `${matches.join('・')}など、${suffix}`;
  }
  const titleWords = source
    .replace(/[「」【】｜|。、！？!?]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !isBadMailPhrase(word))
    .slice(0, 2);
  return titleWords.length ? `${titleWords.join('・')}という特徴が伝わりやすい点` : '';
}

function pickManualAppeal(text: string, projectSource = '') {
  if (!text) return '';
  const sentence = text
    .split(/[。！？!?]/)
    .map((value) => cleanAnalysisPhrase(value))
    .find((value) =>
      value.length >= 8 &&
      value.length <= 90 &&
      /魅力|強み|特徴|印象|見せ|伝え|背景|用途|シーン|体験|応援|安心|便利|継続/.test(value) &&
      isPhraseCompatibleWithProject(value, projectSource)
    );
  return sentence ? toMailSafeAppeal(sentence) : '';
}

function pickManualTarget(text: string, projectSource = '') {
  const match = text.match(/(?:ターゲット|使う人|対象|利用者|支援者|向け)\s*[:：]?\s*([^。！？!?]{3,45})/);
  const target = match?.[1] ? cleanAnalysisPhrase(match[1]) : '';
  return target && isPhraseCompatibleWithProject(target, projectSource) ? target : '';
}

function cleanAnalysisPhrase(value: string) {
  return sanitizeAnalysisSource(value)
    .replace(/^(商品の魅力|特徴|強み|ターゲット|使う人|対象|利用者|支援者)\s*[:：]\s*/, '')
    .trim();
}

function toMailSafeAppeal(strength: string, title?: string | null) {
  const cleaned = strength
    .replace(/可能性があります。?$/, '点')
    .replace(/メール生成前に確認してください。?$/, '')
    .replace(/商品説明から読み取れる特徴を/g, '')
    .trim();
  if (cleaned && !isBadMailPhrase(cleaned)) return cleaned;
  if (title) return `プロジェクトの目的や背景が分かりやすく伝えられている点`;
  return '取り組みの背景や想いが伝わりやすい点';
}

function ensureCompatibleAppeal(appeal: string, projectSource: string) {
  if (!appeal || isBadMailPhrase(appeal) || !isPhraseCompatibleWithProject(appeal, projectSource)) {
    return 'プロジェクトの目的や背景が分かりやすく伝えられている点';
  }
  return appeal;
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

function isBadMailPhrase(value: string) {
  return /確認してください|未取得|TODO|カテゴリーからさがす|達成率|残り日数|支援額|支援者数|商品説明から読み取れる/.test(value);
}

function cleanProjectTitleForMail(title?: string | null) {
  return (title || '')
    .replace(/^Makuake[｜|]\s*/i, '')
    .replace(/\s*[｜|]\s*Makuake（マクアケ）$/i, '')
    .replace(/\s*[｜|]\s*Makuake$/i, '')
    .trim();
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
    source.match(/サーモン|スモークサーモン|ハム|肉|魚|海鮮|食品|グルメ|料理|食卓|味|香り|燻製|伏流水/) ? '素材の魅力や職人技、味わいを想像しやすい点を伝えやすい可能性があります。' : '',
    source.match(/米びつ|米櫃|真空保存|鮮度|キッチン|分割保存|保存容器|収納|お米/) ? 'お米の鮮度を保ちながら、キッチンに収まりやすく分けて保存できる点を伝えやすい可能性があります。' : '',
    source.match(/エアベッド|ベッド|寝られる|寝心地|空気|マットレス|キャンプ|車中泊|アウトドア/) ? '屋内外で使いやすく、寝心地や持ち運びやすさを訴求しやすい点を伝えやすい可能性があります。' : '',
    source.match(/軽量|コンパクト|持ち運び/) ? '持ち運びやすさを伝えやすい可能性があります。' : '',
    source.match(/防災|安全|守/) ? '安心感や備えの必要性を切り口にしやすい可能性があります。' : '',
    source.match(/便利|簡単|時短/) ? '日常の不便を減らす商品として伝えやすい可能性があります。' : ''
  ].filter(Boolean);
  return strengths.length ? strengths : ['プロジェクトの背景や目的が伝わりやすい点を確認できます。'];
}

function buildLocalTargetUsers(category?: string | null, description?: string | null) {
  const source = `${category || ''} ${description || ''}`;
  if (/飲食|焼き鳥|焼鳥|炭火|居酒屋|レストラン|店舗|リフォーム|改装|創業/.test(source)) return ['地域に根ざした店舗を応援したい方', '飲食店の継続や再開を応援したい方'];
  if (/サーモン|スモークサーモン|ハム|肉|魚|海鮮|食品|グルメ|料理|食卓|味|香り|燻製|伏流水/.test(source)) return ['食の品質や特別な味わいを楽しみたい方', 'ギフトや食卓の一品を探している方'];
  if (/米びつ|米櫃|真空保存|鮮度|キッチン|分割保存|保存容器|収納|お米/.test(source)) return ['お米の保存状態やキッチン収納を重視する方', '日々の食材管理をしやすくしたい方'];
  if (/エアベッド|ベッド|寝られる|寝心地|空気|マットレス|キャンプ|車中泊|アウトドア/.test(source)) return ['キャンプや車中泊、来客時の寝具を手軽に用意したい方', '持ち運びやすい寝具を探している方'];
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
  project?: { url?: string | null; description?: string | null; platform?: { name?: string | null; type?: string | null } | null } | null
) {
  const platformName = projectPlatformLabel(project);
  const checks = [
    `会社名と商品名が${platformName}ページと一致しているか確認する。`,
    project?.description ? '商品特徴がメール本文に入れて問題ない表現か確認する。' : `商品特徴を${platformName}ページから手動で補足する。`,
    lead.contactEmail || lead.contactFormUrl || lead.siteMessageUrl ? '送信先がメール・フォーム・サイト内メッセージのどれか確認する。' : '送信先メール、問い合わせフォーム、サイト内メッセージの有無を確認する。'
  ];
  if (lead.brandWebsiteUrl || lead.instagramUrl || lead.tiktokUrl || lead.xUrl) {
    checks.push('公式サイトやSNSの見せ方を確認し、メール内で触れるべきか判断する。');
  }
  if (project?.url) checks.push(`${platformName}ページを開き、終了日や公開状態が変わっていないか確認する。`);
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
