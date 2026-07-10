import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';

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

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

@Injectable()
export class OpenAiClientService {
  async createSalesMailDraft(input: SalesMailDraftInput): Promise<SalesMailDraftOutput> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('OpenAI APIキーが未設定です。.env の OPENAI_API_KEY を確認してください。');
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const maxTokens = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 1200);
    const startedAt = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: Number.isFinite(maxTokens) ? maxTokens : 1200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: this.buildSystemPrompt()
          },
          {
            role: 'user',
            content: JSON.stringify(this.compactInput(input))
          }
        ]
      })
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new BadGatewayException(this.toJapaneseOpenAiError(rawText, response.status));
    }

    let payload: ChatCompletionResponse;
    try {
      payload = JSON.parse(rawText) as ChatCompletionResponse;
    } catch {
      throw new BadGatewayException('OpenAIの応答を読み取れませんでした。もう一度お試しください。');
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new BadGatewayException('OpenAIからメール本文が返りませんでした。もう一度お試しください。');
    }

    const parsed = this.normalizeDraft(this.parseDraftJson(content), input);
    const usage = {
      inputTokens: payload.usage?.prompt_tokens,
      outputTokens: payload.usage?.completion_tokens,
      totalTokens: payload.usage?.total_tokens,
      costUsd: this.estimateCost(payload.usage?.prompt_tokens, payload.usage?.completion_tokens)
    };

    return {
      ...parsed,
      usage,
      model,
      latencyMs: Date.now() - startedAt,
      rawOutput: parsed
    };
  }

  private buildSystemPrompt() {
    return [
      'あなたは日本語のBtoB営業メール作成アシスタントです。',
      'クラウドファンディング掲載プロジェクトの事実だけを使い、低圧で丁寧な営業メール下書きを作成してください。',
      '出力はJSONのみ。キーは subject, body, factsUsed, assumptions, riskFlags。',
      'subject/bodyは文字列、factsUsed/assumptions/riskFlagsは文字列配列。',
      'subjectは必ず「【取得元】でのプロジェクトを拝見しご連絡いたしました」にしてください。【取得元】にはproject.platformNameを使ってください。',
      'bodyは必ず次の定型文の順番、敬体を守ってください。見出しや箇条書きは入れないでください。',
      '改行は読みやすい営業メールとして整えてください。1段落ごとに空行を1つだけ入れ、1文の途中に空行を入れないでください。',
      '1段落は原則1〜2文にしてください。句点「。」で自然に区切り、読点「、」の直後で段落を分けないでください。',
      '短い固定挨拶以外は、テンプレートの改行位置をそのままコピーせず、意味のまとまりごとに自然な段落にしてください。',
      '宛名は、会社名がある場合は「会社名 ご担当者様」と入れてください。担当者名がない場合に担当者名を推測しないでください。「様」を二重に付けないでください。',
      '【商品名】にはproject.titleを使ってください。',
      '【商品の魅力・特徴・強み】にはproject.descriptionやleadReasonから、事実に基づく魅力を1文で自然に入れてください。',
      '【使う人】には商品説明から自然に考えられる利用者層を短く入れてください。推測した場合はassumptionsに入れてください。',
      '達成率、残り日数、支援額、支援者数、カテゴリ名、「カテゴリーからさがす」は商品の魅力として絶対に書かないでください。',
      '店舗改装、飲食店、地域支援、家族事情の案件は「商品」ではなく「プロジェクト」「取り組み」として自然に書いてください。',
      '飲食店の案件で「お子さま」「ご家族の暮らし」など無関係な利用者層を推測しないでください。',
      '余計な過去商品分析、動画アイデア、強い提案、情報交換依頼、上長確認のような文は追加しないでください。',
      '本文テンプレート:',
      '【企業名＋ご担当者】',
      '',
      'お世話になっております。',
      '株式会社第弐ヴォヌールの山本と申します。',
      '',
      '【取得元】にて、貴社の「【商品名】」を拝見しました。',
      '',
      '【商品の魅力・特徴・強み】という点がとても印象的で、【使う人】にとって、実際の使用シーンをイメージしやすい商品だと感じました。',
      '',
      '弊社では、クラウドファンディング支援およびSNSマーケティング支援を行っております。',
      '',
      '実績としては、SNS運用で1か月総再生400万回超、クラウドファンディング領域では、担当商品で3,500万円規模の売上実績がございます。',
      '',
      '商品の魅力を伝える見せ方や、売上につながる導線づくりの面でもお手伝いしております。',
      '',
      'もし何かお力になれそうな機会がございましたら、お気軽にご連絡いただけますと幸いです。',
      '送信済みのような表現、自動送信、断定的な成果保証、過度な売り込みは避けてください。',
      '特徴が不足する場合は推測で埋めず、自然な短文にしてください。'
    ].join('\n');
  }

  private compactInput(input: SalesMailDraftInput) {
    const descriptionLimit = Number(process.env.OPENAI_MAX_DESCRIPTION_CHARS || 1200);
    const maxDescriptionLength = Number.isFinite(descriptionLimit) ? descriptionLimit : 1200;

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
        description: this.truncate(input.projectDescription, maxDescriptionLength)
      },
      leadReason: this.sanitizeSourceText(input.leadReason),
      brandAnalysisMemo: this.sanitizeSourceText(input.brandAnalysisMemo),
      snsAnalysisMemo: this.sanitizeSourceText(input.snsAnalysisMemo)
    };
  }

  private parseDraftJson(content: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new BadGatewayException('OpenAIのメール生成結果がJSON形式ではありませんでした。もう一度お試しください。');
    }

    if (!this.isDraftShape(parsed)) {
      throw new BadGatewayException('OpenAIのメール生成結果に必要な項目が不足しています。もう一度お試しください。');
    }

    return {
      subject: parsed.subject.trim(),
      body: parsed.body.trim(),
      factsUsed: parsed.factsUsed,
      assumptions: parsed.assumptions,
      riskFlags: parsed.riskFlags
    };
  }

  private normalizeDraft(
    draft: {
      subject: string;
      body: string;
      factsUsed: string[];
      assumptions: string[];
      riskFlags: string[];
    },
    input: SalesMailDraftInput
  ) {
    return {
      ...draft,
      subject: this.expectedSubject(input),
      body: this.composeStableMailBody(input, draft.body),
      factsUsed: Array.from(new Set([`取得元: ${this.cleanPhrase(input.projectPlatformName) || 'クラウドファンディングサイト'}`, ...draft.factsUsed]))
    };
  }

  private composeStableMailBody(input: SalesMailDraftInput, aiBody: string) {
    const companyName = this.cleanPhrase(input.companyName) || 'ご担当者';
    const productName = this.cleanProjectTitle(input.projectTitle) || '貴社プロジェクト';
    const platformName = this.cleanPhrase(input.projectPlatformName) || 'クラウドファンディングサイト';
    const appeal = this.extractAppeal(input, aiBody);
    const targetUser = this.extractTargetUser(input, aiBody);
    const subjectType = this.projectSubjectType(input);

    return [
      `${companyName} ご担当者様`,
      'お世話になっております。\n株式会社第弐ヴォヌールの山本と申します。',
      `${platformName}にて、貴社の「${productName}」を拝見しました。`,
      `${this.withPointSuffix(appeal)}がとても印象的で、${targetUser}にとって、${subjectType}の魅力をイメージしやすい内容だと感じました。`,
      '弊社では、クラウドファンディング支援およびSNSマーケティング支援を行っております。',
      '実績としては、SNS運用で1か月総再生400万回超、クラウドファンディング領域では、担当商品で3,500万円規模の売上実績がございます。',
      `${subjectType === '取り組み' ? 'プロジェクト' : '商品'}の魅力を伝える見せ方や、売上につながる導線づくりの面でもお手伝いしております。`,
      'もし何かお力になれそうな機会がございましたら、お気軽にご連絡いただけますと幸いです。'
    ].join('\n\n');
  }

  private withPointSuffix(value: string) {
    const cleaned = this.cleanPhrase(value);
    return cleaned.endsWith('点') ? cleaned : `${cleaned}という点`;
  }

  private extractAppeal(input: SalesMailDraftInput, aiBody: string) {
    const sourceBundle = this.sourceBundle(input, aiBody);
    const specialAppeal = this.specialCaseAppeal(input);
    if (specialAppeal) return specialAppeal;

    const candidates = [
      this.pickSentence(sourceBundle.description, /(?:特徴|印象的|魅力|強み|可能|でき|守|使|選|持ち運|コンパクト|軽量|防災|安心|便利|楽し|体験|香り|味わい|店舗|リフォーム|改装|営業|地域|飲食|焼き鳥|炭火)/),
      this.firstSentence(sourceBundle.description),
      this.pickSentence(sourceBundle.aiBody, /(?:特徴|印象的|魅力|強み|可能|でき|守|使|選|持ち運|コンパクト|軽量|防災|安心|便利|楽し|体験|香り|味わい|店舗|リフォーム|改装|営業|地域|飲食|焼き鳥|炭火)/)
    ]
      .map((value) => this.cleanPhrase(value))
      .filter((value) => !this.isBadAppeal(value))
      .filter(Boolean);
    const selected = candidates[0] || '商品の特徴や利用シーンが分かりやすい';
    return this.toAppealPhrase(this.trimJapaneseSentence(selected, 72))
      .replace(/という点$/, '')
      .replace(/点が魅力です$/, '点')
      .replace(/点が印象的です$/, '点');
  }

  private toAppealPhrase(value: string) {
    return value
      .replace(/できます$/, 'できる点')
      .replace(/可能です$/, '可能な点')
      .replace(/守ります$/, '守れる点')
      .replace(/使えます$/, '使える点')
      .replace(/選択可能です$/, '選択できる点')
      .replace(/です$/, 'である点')
      .replace(/ます$/, 'る点');
  }

  private extractTargetUser(input: SalesMailDraftInput, aiBody: string) {
    const source = `${input.projectCategory || ''} ${input.projectTitle || ''} ${input.projectDescription || ''} ${input.brandAnalysisMemo || ''} ${input.snsAnalysisMemo || ''}`;
    const manualTarget = this.pickManualTarget(source);
    if (manualTarget) return manualTarget;
    if (/飲食|焼き鳥|焼鳥|炭火|居酒屋|レストラン|店舗|リフォーム|改装|浜松町|創業/.test(source)) {
      return '店舗の継続や地域に根ざしたお店を応援したい方';
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

  private projectSubjectType(input: SalesMailDraftInput) {
    const source = `${input.projectTitle || ''} ${input.projectDescription || ''} ${input.projectCategory || ''} ${input.brandAnalysisMemo || ''} ${input.snsAnalysisMemo || ''}`;
    if (/飲食|焼き鳥|焼鳥|炭火|居酒屋|レストラン|店舗|リフォーム|改装|地域|支援/.test(source)) {
      return '取り組み';
    }
    return '商品';
  }

  private sourceBundle(input: SalesMailDraftInput, aiBody: string) {
    return {
      description: this.sanitizeSourceText([input.projectDescription, input.brandAnalysisMemo, input.snsAnalysisMemo].filter(Boolean).join(' ')),
      aiBody: this.sanitizeSourceText(aiBody)
    };
  }

  private specialCaseAppeal(input: SalesMailDraftInput) {
    const source = `${input.projectTitle || ''} ${input.projectDescription || ''} ${input.brandAnalysisMemo || ''} ${input.snsAnalysisMemo || ''}`;
    if (/飲食|焼き鳥|焼鳥|炭火|居酒屋|レストラン|店舗|リフォーム|改装|浜松町|創業/.test(source)) {
      return '長年親しまれてきた店舗をより利用しやすい形で継続しようとされている点';
    }
    if (/米びつ|米櫃|真空保存|鮮度|キッチン|分割保存|保存容器|収納|お米/.test(source)) {
      return 'お米の鮮度を保ちながら、キッチンに収まりやすい形で分けて保存できる点';
    }
    if (/醤油差し|醤油|サイフォン|有田焼|陶磁器|器|食卓|残量|ガラス管|NEO CLAY/i.test(source)) {
      return '残量が見えやすく、食卓で使う道具としての機能性とデザイン性を両立している点';
    }
    if (/エアベッド|ベッド|寝られる|寝心地|空気|マットレス|キャンプ|車中泊|アウトドア/.test(source)) {
      return '屋内外で使いやすく、寝心地や持ち運びやすさを訴求しやすい点';
    }
    return '';
  }

  private pickManualTarget(text: string) {
    const match = text.match(/(?:ターゲット|使う人|対象|利用者|支援者|向け)\s*[:：]?\s*([^。！？!?]{3,45})/);
    return match?.[1] ? this.cleanPhrase(match[1]) : '';
  }

  private sanitizeSourceText(value: string | null | undefined) {
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

  private isBadAppeal(value: string) {
    return !value || /達成率|残り日数|支援額|支援者数|カテゴリーからさがす|カテゴリ[:：]|特別価格|限定価格|早割|割引|価格でご提供|確認してください|未取得|TODO/.test(value);
  }

  private pickSentence(value: string, pattern: RegExp) {
    return value
      .split(/[。！？!?]\s*/)
      .map((item) => item.trim())
      .find((item) => item.length >= 12 && pattern.test(item));
  }

  private firstSentence(value: string | null | undefined) {
    return (value || '')
      .split(/[。！？!?]\s*/)
      .map((item) => item.trim())
      .find(Boolean);
  }

  private cleanPhrase(value: string | null | undefined) {
    return (value || '')
      .replace(/\s+/g, ' ')
      .replace(/^[・、。]+/, '')
      .replace(/[。]+$/, '')
      .trim();
  }

  private cleanProjectTitle(value: string | null | undefined) {
    return this.cleanPhrase(value)
      .replace(/^Makuake[｜|]\s*/i, '')
      .replace(/\s*[｜|]\s*Makuake（マクアケ）$/i, '')
      .replace(/\s*[｜|]\s*Makuake$/i, '')
      .trim();
  }

  private trimJapaneseSentence(value: string, maxLength: number) {
    const cleaned = this.cleanPhrase(value);
    if (cleaned.length <= maxLength) return cleaned;
    const sliced = cleaned.slice(0, maxLength);
    const punctuation = Math.max(sliced.lastIndexOf('、'), sliced.lastIndexOf('。'));
    return (punctuation > 24 ? sliced.slice(0, punctuation) : sliced).trim();
  }

  private formatMailBody(value: string) {
    const lines = value
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) return '';

    const paragraphs: string[] = [];
    let current = '';

    for (const line of lines) {
      if (!current) {
        current = line;
        continue;
      }

      if (this.shouldStartNewParagraph(current, line)) {
        paragraphs.push(current);
        current = line;
      } else {
        current = this.joinJapaneseLines(current, line);
      }
    }

    if (current) {
      paragraphs.push(current);
    }

    return paragraphs
      .map((paragraph) => paragraph.replace(/見せる短尺動画で見せる/g, '短尺動画で伝える').trim())
      .join('\n\n')
      .replace(/、\n\n/g, '、')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private shouldStartNewParagraph(previous: string, next: string) {
    if (previous.endsWith('様')) return true;
    if (next === 'お世話になっております。') return true;
    if (previous === 'お世話になっております。') return false;
    if (next.match(/(?:CAMPFIRE|Makuake|GREEN FUNDING|クラウドファンディングサイト)にて/)) return true;
    if (next.includes('という点がとても印象的で')) return true;
    if (next.startsWith('弊社では、')) return true;
    if (next.startsWith('実績としては')) return true;
    if (next.startsWith('商品の魅力を伝える')) return true;
    if (next.startsWith('もし何かお力になれそうな機会がございましたら')) return true;
    return previous.endsWith('。') && next.length > 28;
  }

  private joinJapaneseLines(previous: string, next: string) {
    return `${previous}${next}`;
  }

  private expectedSubject(input?: SalesMailDraftInput) {
    const platformName = this.cleanPhrase(input?.projectPlatformName) || 'クラウドファンディング';
    return `${platformName}でのプロジェクトを拝見しご連絡いたしました`;
  }

  private isDraftShape(value: unknown): value is {
    subject: string;
    body: string;
    factsUsed: string[];
    assumptions: string[];
    riskFlags: string[];
  } {
    if (!value || typeof value !== 'object') return false;
    const draft = value as Record<string, unknown>;
    return (
      typeof draft.subject === 'string' &&
      typeof draft.body === 'string' &&
      Array.isArray(draft.factsUsed) &&
      Array.isArray(draft.assumptions) &&
      Array.isArray(draft.riskFlags) &&
      draft.factsUsed.every((item) => typeof item === 'string') &&
      draft.assumptions.every((item) => typeof item === 'string') &&
      draft.riskFlags.every((item) => typeof item === 'string')
    );
  }

  private estimateCost(inputTokens?: number, outputTokens?: number) {
    const inputCostPer1m = Number(process.env.OPENAI_INPUT_COST_PER_1M || '');
    const outputCostPer1m = Number(process.env.OPENAI_OUTPUT_COST_PER_1M || '');
    if (!inputTokens || !outputTokens || !Number.isFinite(inputCostPer1m) || !Number.isFinite(outputCostPer1m)) {
      return undefined;
    }

    return (inputTokens / 1_000_000) * inputCostPer1m + (outputTokens / 1_000_000) * outputCostPer1m;
  }

  private toJapaneseOpenAiError(rawText: string, status: number) {
    if (rawText.includes('insufficient_quota')) {
      return 'OpenAI APIの残高または利用上限が不足しています。OpenAI PlatformのBillingを確認してください。';
    }
    if (status === 401) {
      return 'OpenAI APIキーが無効です。.env の OPENAI_API_KEY を確認してください。';
    }
    if (status === 429) {
      return 'OpenAI APIの利用制限に達しました。少し待ってから再実行してください。';
    }
    return `OpenAI APIでエラーが発生しました。status=${status}`;
  }

  private truncate(value: string | null | undefined, maxLength: number) {
    if (!value) return value;
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }
}
