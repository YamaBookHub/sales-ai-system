import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';

export type SalesMailDraftInput = {
  templateKey: string;
  tone?: string;
  companyName: string;
  projectTitle?: string | null;
  projectUrl?: string | null;
  projectCategory?: string | null;
  projectDescription?: string | null;
  projectAmount?: number | null;
  supporterCount?: number | null;
  leadReason?: string | null;
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
      'CAMPFIRE掲載プロジェクトの事実だけを使い、低圧で丁寧な営業メール下書きを作成してください。',
      '出力はJSONのみ。キーは subject, body, factsUsed, assumptions, riskFlags。',
      'subject/bodyは文字列、factsUsed/assumptions/riskFlagsは文字列配列。',
      'subjectは必ず「CAMPFIREでのプロジェクトを拝見しご連絡いたしました」にしてください。',
      'bodyは必ず次の定型文の順番、改行、敬体を守ってください。見出しや箇条書きは入れないでください。',
      '【企業名＋ご担当者】には、会社名がある場合は「会社名 ご担当者様」と入れてください。担当者名がない場合に担当者名を推測しないでください。',
      '【過去の商品の傾向】には、入力情報から言えるカテゴリ・商品傾向を1文で入れてください。過去商品が不明な場合は「暮らしや課題解決に役立つプロダクト」のように、断定しすぎない表現にしてください。',
      '【現在出品中の商品名】にはproject.titleを使ってください。',
      '【商品の機能や特徴】にはproject.descriptionやleadReasonから2〜3個の特徴を自然な文章で入れてください。',
      '【ターゲット】には商品説明から自然に考えられる利用者層を短く入れてください。推測した場合はassumptionsに入れてください。',
      '【動画での具体的な見せ方のアイデア】には使用シーン、悩み、ビフォーアフター、利用手順のいずれかを使った具体案を1文で入れてください。',
      '本文テンプレート:',
      '【企業名＋ご担当者】',
      '',
      'お世話になっております。',
      'クラウドファンディング支援およびSNSマーケティング支援をしている、',
      '株式会社第弐ヴォヌールの山本と申します。',
      '',
      'CAMPFIREにて御社のプロジェクトを拝見し、',
      '【過去の商品の傾向】を継続的にクラウドファンディングで展開されている点に、',
      '',
      '弊社のクラウドファンディング支援・SNSマーケティング支援との親和性を感じ、',
      'ご連絡いたしました。',
      '',
      '特に、現在公開中の「【現在出品中の商品名】」は、',
      '【商品の機能や特徴】といった特徴があり、',
      '【ターゲット】にとって使用シーンをイメージしやすい商品だと感じました。',
      '',
      'こうした体感を伝えやすい商品は、',
      '【動画での具体的な見せ方のアイデア】を短尺動画で見せることで、',
      'SNSでも関心を持っていただきやすいと考えております。',
      '',
      '弊社では、クラウドファンディング支援をはじめ、SNSを活用した集客、',
      '販売導線の設計、ディスプレイ広告・SNS広告を活用した認知拡大まで、',
      '一貫してお手伝いしております。',
      '',
      '実績としましても、',
      'SNS運用において1か月で総再生400万回超・フォロワー4,000人増加、',
      'クラウドファンディング領域では担当商品で3,500万円規模の売上がございます。',
      '',
      'もしご関心がございましたら、',
      'まずは15〜20分ほど、情報交換のお時間をいただけますと幸いです。',
      '',
      'ご検討のほど、よろしくお願いいたします。',
      '送信済みのような表現、自動送信、断定的な成果保証、過度な売り込みは避けてください。',
      '特徴が不足する場合は推測で埋めず、自然な短文にしてください。'
    ].join('\n');
  }

  private compactInput(input: SalesMailDraftInput) {
    const descriptionLimit = Number(process.env.OPENAI_MAX_DESCRIPTION_CHARS || 1200);
    const maxDescriptionLength = Number.isFinite(descriptionLimit) ? descriptionLimit : 1200;

    return {
      task: 'CAMPFIRE営業メール下書き生成',
      templateKey: input.templateKey,
      tone: input.tone || 'low_sales_pressure',
      companyName: input.companyName,
      project: {
        title: input.projectTitle,
        url: input.projectUrl,
        category: input.projectCategory,
        amount: input.projectAmount,
        supporterCount: input.supporterCount,
        description: this.truncate(input.projectDescription, maxDescriptionLength)
      },
      leadReason: input.leadReason
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
    const bodyParts = draft.body.split(/\n+/).map((part) => part.trim()).filter(Boolean);
    const bodyText = bodyParts.join('\n');
    const expectedHeader = `${input.companyName} ご担当者様`;
    const startsWithCompany = bodyText.startsWith(input.companyName);
    const hasRecipient = bodyText.includes('ご担当者様') || bodyText.includes('ご担当者 様');
    const closing = 'ご検討のほど、よろしくお願いいたします。';
    let body = draft.body.trim();

    if (!startsWithCompany) {
      body = `${expectedHeader}\n\n${body}`;
    } else if (!hasRecipient) {
      body = body.replace(input.companyName, expectedHeader);
    }

    if (!body.endsWith(closing)) {
      body = `${body}\n\n${closing}`;
    }

    return {
      ...draft,
      subject: this.expectedSubject(),
      body: body.trim()
    };
  }

  private expectedSubject() {
    return 'CAMPFIREでのプロジェクトを拝見しご連絡いたしました';
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
