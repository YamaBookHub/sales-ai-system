import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { SelectableGeminiModel } from './domain/ai-model';
import { MAIL_DRAFT_JSON_SCHEMA, parseMailDraftJson } from './domain/ai-output-validator';
import {
  compactSalesMailDraftInput,
  normalizeOpenAiSalesMailDraft,
  SalesMailDraftInput,
  SalesMailDraftOutput
} from './domain/openai-sales-mail-draft';
import {
  parseSemanticConsistencyJson,
  SemanticConsistencyInput,
  SemanticConsistencyResult,
  SEMANTIC_CONSISTENCY_JSON_SCHEMA
} from './domain/semantic-consistency';
import { buildSalesMailDraftSystemPrompt } from './prompts/sales-mail-draft.prompt';
import { buildSemanticConsistencySystemPrompt, compactSemanticConsistencyInput } from './prompts/semantic-consistency.prompt';

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
    finishMessage?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
  modelVersion?: string;
};

const GEMINI_PRICING_USD_PER_1M: Record<SelectableGeminiModel, { input: number; output: number }> = {
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
  'gemini-3.5-flash': { input: 1.5, output: 9 }
};

@Injectable()
export class GeminiClientService {
  async createSalesMailDraft(input: SalesMailDraftInput, model: SelectableGeminiModel): Promise<SalesMailDraftOutput> {
    const maxDescriptionLength = numberFromEnv('GEMINI_MAX_DESCRIPTION_CHARS', 1200);
    const startedAt = Date.now();
    const payload = await this.generateJson(
      model,
      buildSalesMailDraftSystemPrompt(model),
      compactSalesMailDraftInput(input, maxDescriptionLength),
      MAIL_DRAFT_JSON_SCHEMA,
      numberFromEnv('GEMINI_MAX_OUTPUT_TOKENS', 1600)
    );
    const content = geminiText(payload);
    const parsed = normalizeOpenAiSalesMailDraft(parseMailDraftJson(content), input);
    const inputTokens = payload.usageMetadata?.promptTokenCount;
    const outputTokens = sumDefined(
      payload.usageMetadata?.candidatesTokenCount,
      payload.usageMetadata?.thoughtsTokenCount
    );

    return {
      ...parsed,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: payload.usageMetadata?.totalTokenCount,
        costUsd: estimateGeminiCost(model, inputTokens, outputTokens)
      },
      model,
      latencyMs: Date.now() - startedAt,
      rawOutput: parsed
    };
  }

  async checkSemanticConsistency(
    input: SemanticConsistencyInput,
    model: SelectableGeminiModel
  ): Promise<SemanticConsistencyResult & { model: string; latencyMs: number }> {
    const startedAt = Date.now();
    const payload = await this.generateJson(
      model,
      buildSemanticConsistencySystemPrompt(),
      compactSemanticConsistencyInput(input),
      SEMANTIC_CONSISTENCY_JSON_SCHEMA,
      numberFromEnv('GEMINI_SEMANTIC_CHECK_MAX_OUTPUT_TOKENS', 600)
    );

    return {
      ...parseSemanticConsistencyJson(geminiText(payload)),
      model,
      latencyMs: Date.now() - startedAt
    };
  }

  private async generateJson(
    model: SelectableGeminiModel,
    systemInstruction: string,
    input: unknown,
    responseSchema: Record<string, unknown>,
    maxOutputTokens: number
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('Gemini APIキーが未設定です。.env の GEMINI_API_KEY を確認してください。');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
          generationConfig: {
            maxOutputTokens,
            thinkingConfig: {
              thinkingLevel: model === 'gemini-3.1-flash-lite' ? 'MINIMAL' : 'LOW'
            },
            responseMimeType: 'application/json',
            responseSchema
          }
        })
      }
    );

    const rawText = await response.text();
    if (!response.ok) {
      throw new BadGatewayException(toJapaneseGeminiError(rawText, response.status));
    }

    try {
      return JSON.parse(rawText) as GeminiGenerateContentResponse;
    } catch {
      throw new BadGatewayException('Geminiの応答を読み取れませんでした。もう一度お試しください。');
    }
  }
}

function geminiText(payload: GeminiGenerateContentResponse) {
  const content = payload.candidates?.[0]?.content?.parts
    ?.filter((part) => !part.thought)
    .map((part) => part.text || '')
    .join('')
    .trim();
  if (content) return content;

  const blockReason = payload.promptFeedback?.blockReason;
  const finishReason = payload.candidates?.[0]?.finishReason;
  const detail = blockReason || finishReason;
  throw new BadGatewayException(
    detail ? `Geminiから本文が返りませんでした（${detail}）。入力内容を確認してください。` : 'Geminiから本文が返りませんでした。もう一度お試しください。'
  );
}

function sumDefined(...values: Array<number | undefined>) {
  const defined = values.filter((value): value is number => typeof value === 'number');
  return defined.length ? defined.reduce((sum, value) => sum + value, 0) : undefined;
}

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) ? value : fallback;
}

function estimateGeminiCost(model: SelectableGeminiModel, inputTokens?: number, outputTokens?: number) {
  if (inputTokens === undefined || outputTokens === undefined) return undefined;
  const pricing = GEMINI_PRICING_USD_PER_1M[model];
  const envPrefix = model === 'gemini-3.1-flash-lite' ? 'GEMINI_FLASH_LITE' : 'GEMINI_FLASH';
  const inputRate = positiveNumberFromEnv(`${envPrefix}_INPUT_COST_PER_1M`, pricing.input);
  const outputRate = positiveNumberFromEnv(`${envPrefix}_OUTPUT_COST_PER_1M`, pricing.output);
  return (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
}

function positiveNumberFromEnv(name: string, fallback: number) {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;
  const value = Number(rawValue);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function toJapaneseGeminiError(rawText: string, status: number) {
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(rawText)) {
    return 'Gemini APIキーが無効です。.env の GEMINI_API_KEY を確認してください。';
  }
  if (status === 429) {
    return 'Gemini APIの無料枠または利用制限に達しました。Google AI Studioの利用状況を確認してから再実行してください。';
  }
  if (status === 400) {
    return 'Gemini APIがリクエストを受け付けませんでした。モデル設定または入力内容を確認してください。';
  }
  return `Gemini APIでエラーが発生しました。status=${status}`;
}
