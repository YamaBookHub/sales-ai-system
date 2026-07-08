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
      'bodyは必ず次の順番で構成してください。順番を入れ替えないでください。',
      '1. 会社名',
      '2. 空行',
      '3. ご担当者様',
      '4. 空行',
      '5. 固定自己紹介',
      '6. プロジェクトを見た理由と親和性',
      '7. 商品特徴と良いと思った点',
      '8. SNSでの見せ方',
      '9. 弊社支援範囲',
      '10. 固定実績紹介',
      '11. 情報交換依頼',
      '12. 固定締め',
      'メール本文の冒頭は必ず「会社名」「空行」「ご担当者様」「空行」から始めてください。',
      '固定自己紹介は必ず次の3行をそのまま入れてください。',
      'お世話になっております。',
      'クラウドファンディング支援およびSNSマーケティング支援をしている、',
      '株式会社第弐ヴォヌールの山本と申します。',
      '固定実績紹介は必ず次の3行をそのまま入れてください。',
      '実績としましても、',
      'SNS運用において1か月で総再生400万回超・フォロワー4,000人増加、',
      'クラウドファンディング領域では担当商品で3,500万円規模の売上がございます。',
      '締めには必ず「まずは15〜20分ほど、情報交換のお時間をいただけますと幸いです。」を入れてください。',
      '本文の最後は必ず「ご検討のほど、よろしくお願いいたします。」で終えてください。',
      '「実績としましても、」は本文後半に置き、自己紹介直後には置かないでください。',
      '送信済みのような表現、自動送信、断定的な成果保証、過度な売り込みは避けてください。',
      '特徴が不足する場合は推測で埋めず、自然な短文にしてください。',
      'bodyは600〜900文字程度にしてください。',
      '通常版の件名は「クラウドファンディング支援に関する情報交換のお願い」。',
      'SNS動画・広告クリエイティブ強化版の件名は「SNS動画・広告クリエイティブ支援に関する情報交換のお願い」。'
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
    const expectedHeader = `${input.companyName}\n\nご担当者様`;
    const startsWithCompany = bodyText.startsWith(input.companyName);
    const hasRecipient = bodyText.includes('ご担当者様');
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
      subject: this.expectedSubject(input.templateKey),
      body: body.trim()
    };
  }

  private expectedSubject(templateKey: string) {
    const normalizedKey = templateKey.toLowerCase();
    return ['creative', 'sns', 'video', 'ad'].some((key) => normalizedKey.includes(key))
      ? 'SNS動画・広告クリエイティブ支援に関する情報交換のお願い'
      : 'クラウドファンディング支援に関する情報交換のお願い';
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
