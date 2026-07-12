import { GenerateMailDto } from '../ai.dto';
import { MailTemplateForDraft, renderMailTemplate } from './template-mail-draft';

export type LocalMailDraftInput = {
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
  sendMethod?: string | null;
  template?: MailTemplateForDraft;
};

export function buildLocalMailInput(
  lead: {
    reason?: string | null;
    sendMethod?: string | null;
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
  dto: GenerateMailDto,
  template?: MailTemplateForDraft
): LocalMailDraftInput {
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
    snsAnalysisMemo: lead.snsAnalysisMemo,
    sendMethod: lead.sendMethod,
    template
  };
}

export function buildLocalMailDraft(input: LocalMailDraftInput) {
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
  const defaultBody = [
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

  const renderedTemplate = input.template
    ? renderMailTemplate(input.template, {
        companyName: input.companyName,
        projectTitle: placeholders.productName,
        platformName,
        projectUrl: input.projectUrl,
        category: input.projectCategory,
        appeal: placeholders.appeal,
        targetUser: placeholders.targetUser,
        subjectType: placeholders.subjectType
      })
    : null;
  const body = renderedTemplate?.body || defaultBody;
  const templateFacts = input.template ? [`定型文: ${input.template.key}`] : [];
  const templateRisks = renderedTemplate?.unresolvedVariables.length
    ? [`未置換の定型文変数があります: ${renderedTemplate.unresolvedVariables.join(', ')}`]
    : [];

  return {
    subject: renderedTemplate?.subject || `${platformName}でのプロジェクトを拝見しご連絡いたしました`,
    body,
    factsUsed: [
      ...templateFacts,
      `会社名: ${input.companyName}`,
      `取得元: ${platformName}`,
      `プロジェクト名: ${placeholders.productName}`,
      `魅力: ${placeholders.appeal}`,
      `想定読者: ${placeholders.targetUser}`,
      input.brandAnalysisMemo ? `ブランド分析メモ: ${input.brandAnalysisMemo}` : '',
      input.snsAnalysisMemo ? `SNS分析メモ: ${input.snsAnalysisMemo}` : ''
    ].filter(Boolean),
    assumptions: ['OpenAI APIを使わず、無料分析で作成した置換項目から本文を作成しています。'],
    riskFlags: [
      '送信前に、会社名・商品名・商品の魅力が相手の案件と合っているか確認してください。',
      ...templateRisks
    ],
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 },
    model: 'local-template-v2',
    latencyMs: 0,
    rawOutput: { placeholders, templateKey: input.template?.key || null, unresolvedVariables: renderedTemplate?.unresolvedVariables || [] }
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
    subjectType
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
