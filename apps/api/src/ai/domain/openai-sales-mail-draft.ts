import { cleanPhrase, expectedSalesMailSubject } from './mail-draft-rules';

export type SalesMailDraftInput = {
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

export type SalesMailDraftOutput = {
  subject: string;
  body: string;
  factsUsed: string[];
  assumptions: string[];
  riskFlags: string[];
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    costUsd?: number;
  };
  model: string;
  latencyMs: number;
  rawOutput: unknown;
};

type ParsedDraft = {
  subject: string;
  body: string;
  factsUsed: string[];
  assumptions: string[];
  riskFlags: string[];
};

export function compactSalesMailDraftInput(input: SalesMailDraftInput, maxDescriptionLength = 1200) {
  return {
    task: 'クラウドファンディング営業メール下書き生成',
    templateKey: input.templateKey,
    tone: input.tone || 'low_sales_pressure',
    companyName: input.companyName,
    project: {
      platformName: input.projectPlatformName || 'クラウドファンディングサイト',
      title: input.projectTitle,
      url: input.projectUrl,
      category: input.projectCategory,
      amount: input.projectAmount,
      supporterCount: input.supporterCount,
        description: truncate(sanitizeSourceText(input.projectDescription), maxDescriptionLength)
    },
    leadReason: sanitizeSourceText(input.leadReason),
    brandAnalysisMemo: sanitizeSourceText(input.brandAnalysisMemo),
    snsAnalysisMemo: sanitizeSourceText(input.snsAnalysisMemo)
  };
}

export function normalizeOpenAiSalesMailDraft(draft: ParsedDraft, input: SalesMailDraftInput): ParsedDraft {
  return {
    ...draft,
    subject: expectedSalesMailSubject(input),
    body: composeStableMailBody(input, draft.body),
    factsUsed: Array.from(new Set([`取得元: ${cleanPhrase(input.projectPlatformName) || 'クラウドファンディングサイト'}`, ...draft.factsUsed]))
  };
}

function composeStableMailBody(input: SalesMailDraftInput, aiBody: string) {
  const companyName = cleanPhrase(input.companyName) || 'ご担当者';
  const productName = cleanProjectTitle(input.projectTitle) || '貴社プロジェクト';
  const platformName = cleanPhrase(input.projectPlatformName) || 'クラウドファンディングサイト';
  const appeal = extractAppeal(input, aiBody);
  const targetUser = extractTargetUser(input);
  const subjectType = projectSubjectType(input);

  return [
    `${companyName} ご担当者様`,
    'お世話になっております。\n株式会社第弐ヴォヌールの山本と申します。',
    `${platformName}にて、貴社の「${productName}」を拝見しました。`,
    `${withPointSuffix(appeal)}がとても印象的で、${targetUser}にとって、${subjectType}の魅力をイメージしやすい内容だと感じました。`,
    '弊社では、クラウドファンディング支援およびSNSマーケティング支援を行っております。',
    '実績としては、SNS運用で1か月総再生400万回超、クラウドファンディング領域では、担当商品で3,500万円規模の売上実績がございます。',
    `${subjectType === '取り組み' ? 'プロジェクト' : '商品'}の魅力を伝える見せ方や、売上につながる導線づくりの面でもお手伝いしております。`,
    'もし何かお力になれそうな機会がございましたら、お気軽にご連絡いただけますと幸いです。'
  ].join('\n\n');
}

function withPointSuffix(value: string) {
  const cleaned = cleanPhrase(value);
  return cleaned.endsWith('点') ? cleaned : `${cleaned}という点`;
}

function extractAppeal(input: SalesMailDraftInput, aiBody: string) {
  const sourceBundle = {
    description: sanitizeSourceText(compatibleProjectSource(input)),
    aiBody: sanitizeSourceText(aiBody)
  };
  const projectSource = compatibleProjectSource(input);
  const specialAppeal = specialCaseAppeal(input);
  if (specialAppeal) return specialAppeal;

  const candidates = [
    pickSentence(sourceBundle.description, /(?:特徴|印象的|魅力|強み|可能|でき|守|使|選|持ち運|コンパクト|軽量|防災|安心|便利|楽し|体験|香り|味わい|店舗|リフォーム|改装|営業|地域|飲食|焼き鳥|炭火)/),
    firstSentence(sourceBundle.description),
    pickSentence(sourceBundle.aiBody, /(?:特徴|印象的|魅力|強み|可能|でき|守|使|選|持ち運|コンパクト|軽量|防災|安心|便利|楽し|体験|香り|味わい|店舗|リフォーム|改装|営業|地域|飲食|焼き鳥|炭火)/)
  ]
    .map((value) => cleanPhrase(value))
    .filter((value) => !isBadAppeal(value))
    .filter((value) => isMemoCompatibleWithProject(value, projectSource))
    .filter(Boolean);
  const selected = candidates[0] || '商品の特徴や利用シーンが分かりやすい';
  return toAppealPhrase(trimJapaneseSentence(selected, 72))
    .replace(/という点$/, '')
    .replace(/点が魅力です$/, '点')
    .replace(/点が印象的です$/, '点');
}

function toAppealPhrase(value: string) {
  return value
    .replace(/できます$/, 'できる点')
    .replace(/可能です$/, '可能な点')
    .replace(/守ります$/, '守れる点')
    .replace(/使えます$/, '使える点')
    .replace(/選択可能です$/, '選択できる点')
    .replace(/です$/, 'である点')
    .replace(/ます$/, 'る点');
}

function extractTargetUser(input: SalesMailDraftInput) {
  const source = compatibleProjectSource(input);
  const manualTarget = pickManualTarget(source);
  if (manualTarget) return manualTarget;
  if (/飲食|焼き鳥|焼鳥|炭火|居酒屋|レストラン|店舗|リフォーム|改装|浜松町|創業/.test(source)) {
    return '店舗の継続や地域に根ざしたお店を応援したい方';
  }
  if (/サーモン|スモークサーモン|ハム|肉|魚|海鮮|食品|グルメ|料理|食卓|味|香り|燻製|伏流水/.test(source)) {
    return '食の品質や特別な味わいを楽しみたい方';
  }
  if (/米びつ|米櫃|真空保存|鮮度|キッチン|分割保存|保存容器|収納|お米/.test(source)) {
    return 'お米の保存状態やキッチン収納を重視する方';
  }
  if (/醤油差し|醤油|サイフォン|有田焼|陶磁器|器|食卓|残量|ガラス管|NEO CLAY/i.test(source)) {
    return '食卓まわりの使いやすさやデザイン性を重視する方';
  }
  if (/エアベッド|ベッド|寝られる|寝心地|空気|マットレス|キャンプ|車中泊|アウトドア/.test(source)) {
    return 'キャンプや車中泊、来客時の寝具を手軽に用意したい方';
  }
  if (/防災|金庫|保管|守|安全|貴重品|書類/.test(source)) return '防災備えや大切な物の保管を重視する方';
  if (/アウトドア|キャンプ|旅行|屋外|持ち運/.test(source)) return '屋外や移動先での使いやすさを重視する方';
  if (/美容|健康|ヘルス|ケア/.test(source)) return '日常のケアや健康意識を大切にする方';
  if (/子ども|学習|教育|学校|本/.test(source)) return 'お子さまやご家族の暮らしを大切にする方';
  return '商品に関心を持つお客様';
}

function projectSubjectType(input: SalesMailDraftInput) {
  const source = compatibleProjectSource(input);
  if (/飲食|焼き鳥|焼鳥|炭火|居酒屋|レストラン|店舗|リフォーム|改装|地域|支援/.test(source)) {
    return '取り組み';
  }
  return '商品';
}

function specialCaseAppeal(input: SalesMailDraftInput) {
  const source = compatibleProjectSource(input);
  if (/飲食|焼き鳥|焼鳥|炭火|居酒屋|レストラン|店舗|リフォーム|改装|浜松町|創業/.test(source)) {
    return '長年親しまれてきた店舗をより利用しやすい形で継続しようとされている点';
  }
  if (/サーモン|スモークサーモン|ハム|肉|魚|海鮮|食品|グルメ|料理|食卓|味|香り|燻製|伏流水/.test(source)) {
    return buildSpecificAppeal(source) || '素材の魅力や職人技が伝わりやすく、味わいを想像しやすい点';
  }
  if (/米びつ|米櫃|真空保存|鮮度|キッチン|分割保存|保存容器|収納|お米/.test(source)) {
    return 'お米の鮮度を保ちながら、キッチンに収まりやすい形で分けて保存できる点';
  }
  if (/醤油差し|醤油|サイフォン|有田焼|陶磁器|器|食卓|残量|ガラス管|NEO CLAY/i.test(source)) {
    return '残量が見えやすく、食卓で使う道具としての機能性とデザイン性を両立している点';
  }
  if (/エアベッド|ベッド|寝られる|寝心地|空気|マットレス|キャンプ|車中泊|アウトドア/.test(source)) {
    return buildSpecificAppeal(source) || '屋内外で使いやすく、寝心地や持ち運びやすさを訴求しやすい点';
  }
  return buildSpecificAppeal(source);
}

function buildSpecificAppeal(projectSource: string) {
  const source = sanitizeSourceText(projectSource);
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
  return '';
}

function pickManualTarget(text: string) {
  const match = text.match(/(?:ターゲット|使う人|対象|利用者|支援者|向け)\s*[:：]?\s*([^。！？!?]{3,45})/);
  return match?.[1] ? cleanPhrase(match[1]) : '';
}

function compatibleProjectSource(input: SalesMailDraftInput) {
  const titleCategorySource = [input.projectTitle, input.projectCategory].filter(Boolean).join(' ');
  const safeDescription = isMemoCompatibleWithProject(input.projectDescription, titleCategorySource) ? input.projectDescription : '';
  const projectSource = [titleCategorySource, safeDescription].filter(Boolean).join(' ');
  const safeBrandMemo = isMemoCompatibleWithProject(input.brandAnalysisMemo, projectSource) ? input.brandAnalysisMemo : '';
  const safeSnsMemo = isMemoCompatibleWithProject(input.snsAnalysisMemo, projectSource) ? input.snsAnalysisMemo : '';
  return [projectSource, safeBrandMemo, safeSnsMemo].filter(Boolean).join(' ');
}

function isMemoCompatibleWithProject(memo?: string | null, projectSource = '') {
  if (!memo || !projectSource) return true;
  const rules = [
    { pattern: /米びつ|米櫃|お米|キッチン|真空保存|鮮度|保存容器|収納/, required: /米びつ|米櫃|お米|キッチン|真空保存|鮮度|保存容器|収納/ },
    { pattern: /サーモン|スモークサーモン|ハム|肉|魚|海鮮|食品|グルメ|料理|食卓|味|香り|燻製|伏流水/, required: /サーモン|スモークサーモン|ハム|肉|魚|海鮮|食品|グルメ|料理|食卓|味|香り|燻製|伏流水/ },
    { pattern: /醤油差し|醤油|サイフォン|有田焼|陶磁器|器|食卓|残量|ガラス管|NEO CLAY/i, required: /醤油差し|醤油|サイフォン|有田焼|陶磁器|器|食卓|残量|ガラス管|NEO CLAY/i },
    { pattern: /エアベッド|寝心地|車中泊|キャンプ|アウトドア|来客|寝具/, required: /エアベッド|ベッド|寝心地|車中泊|キャンプ|アウトドア|来客|寝具/ },
    { pattern: /ライブ|コンサート|ファン|音楽|バンド|周年|公演/, required: /ライブ|コンサート|ファン|音楽|バンド|周年|公演/ },
    { pattern: /焼き鳥|焼鳥|炭火|店舗|飲食|居酒屋|リフォーム|改装/, required: /焼き鳥|焼鳥|炭火|店舗|飲食|居酒屋|リフォーム|改装/ }
  ];
  return rules.every((rule) => !rule.pattern.test(memo) || rule.required.test(projectSource));
}

function sanitizeSourceText(value: string | null | undefined) {
  return (value || '')
    .replace(/達成率\s*[:：]?\s*[0-9,]+%?/g, '')
    .replace(/残り日数\s*[:：]?\s*[0-9,]+日?/g, '')
    .replace(/支援額\s*[:：]?\s*[0-9,]+円?/g, '')
    .replace(/支援者数\s*[:：]?\s*[0-9,]+人?/g, '')
    .replace(/(?:特別価格|限定価格|早割|割引|[0-9,]+円(?:税込)?|価格でご提供|ご提供)/g, '')
    .replace(/特徴\s*[:：]?\s*カテゴリーからさがす/g, '')
    .replace(/カテゴリーからさがす/g, '')
    .replace(/商品説明から読み取れる特徴をメール生成前に確認してください。?/g, '')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBadAppeal(value: string) {
  return !value || /達成率|残り日数|支援額|支援者数|カテゴリーからさがす|カテゴリ[:：]|特別価格|限定価格|早割|割引|価格でご提供|確認してください|未取得|TODO/.test(value);
}

function pickSentence(value: string, pattern: RegExp) {
  return value
    .split(/[。！？!?]\s*/)
    .map((item) => item.trim())
    .find((item) => item.length >= 12 && pattern.test(item));
}

function firstSentence(value: string | null | undefined) {
  return (value || '')
    .split(/[。！？!?]\s*/)
    .map((item) => item.trim())
    .find(Boolean);
}

function cleanProjectTitle(value: string | null | undefined) {
  return cleanPhrase(value)
    .replace(/^Makuake[｜|]\s*/i, '')
    .replace(/\s*[｜|]\s*Makuake（マクアケ）$/i, '')
    .replace(/\s*[｜|]\s*Makuake$/i, '')
    .trim();
}

function trimJapaneseSentence(value: string, maxLength: number) {
  const cleaned = cleanPhrase(value);
  if (cleaned.length <= maxLength) return cleaned;
  const sliced = cleaned.slice(0, maxLength);
  const punctuation = Math.max(sliced.lastIndexOf('、'), sliced.lastIndexOf('。'));
  return (punctuation > 24 ? sliced.slice(0, punctuation) : sliced).trim();
}

function truncate(value: string | null | undefined, maxLength: number) {
  if (!value) return value;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
