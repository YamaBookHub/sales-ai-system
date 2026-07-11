import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { parseMailDraftJson } from './domain/ai-output-validator';
import {
  compactSalesMailDraftInput,
  normalizeOpenAiSalesMailDraft,
  SalesMailDraftInput,
  SalesMailDraftOutput
} from './domain/openai-sales-mail-draft';
import { buildSalesMailDraftSystemPrompt } from './prompts/sales-mail-draft.prompt';

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
    const maxTokens = numberFromEnv('OPENAI_MAX_OUTPUT_TOKENS', 1200);
    const maxDescriptionLength = numberFromEnv('OPENAI_MAX_DESCRIPTION_CHARS', 1200);
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
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: buildSalesMailDraftSystemPrompt()
          },
          {
            role: 'user',
            content: JSON.stringify(compactSalesMailDraftInput(input, maxDescriptionLength))
          }
        ]
      })
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new BadGatewayException(toJapaneseOpenAiError(rawText, response.status));
    }

    const payload = parseChatCompletionResponse(rawText);
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new BadGatewayException('OpenAIからメール本文が返りませんでした。もう一度お試しください。');
    }

    const parsed = normalizeOpenAiSalesMailDraft(parseMailDraftJson(content), input);
    const usage = {
      inputTokens: payload.usage?.prompt_tokens,
      outputTokens: payload.usage?.completion_tokens,
      totalTokens: payload.usage?.total_tokens,
      costUsd: estimateCost(payload.usage?.prompt_tokens, payload.usage?.completion_tokens)
    };

    return {
      ...parsed,
      usage,
      model,
      latencyMs: Date.now() - startedAt,
      rawOutput: parsed
    };
  }
}

function parseChatCompletionResponse(rawText: string): ChatCompletionResponse {
  try {
    return JSON.parse(rawText) as ChatCompletionResponse;
  } catch {
    throw new BadGatewayException('OpenAIの応答を読み取れませんでした。もう一度お試しください。');
  }
}

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) ? value : fallback;
}

function estimateCost(inputTokens?: number, outputTokens?: number) {
  const inputCostPer1m = Number(process.env.OPENAI_INPUT_COST_PER_1M || '');
  const outputCostPer1m = Number(process.env.OPENAI_OUTPUT_COST_PER_1M || '');
  if (!inputTokens || !outputTokens || !Number.isFinite(inputCostPer1m) || !Number.isFinite(outputCostPer1m)) {
    return undefined;
  }

  return (inputTokens / 1_000_000) * inputCostPer1m + (outputTokens / 1_000_000) * outputCostPer1m;
}

function toJapaneseOpenAiError(rawText: string, status: number) {
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
