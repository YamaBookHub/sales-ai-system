import { HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';

export const DEFAULT_OPENAI_REQUEST_ESTIMATE_USD = 0.01;
export const OPENAI_RESERVATION_TTL_MS = 30 * 60 * 1000;

export type OpenAiBudgetConfig = {
  budgetUsd: number | null;
  inputCostPer1m: number | null;
  outputCostPer1m: number | null;
  fallbackRequestEstimateUsd: number;
};

export function readOpenAiBudgetConfig(env: NodeJS.ProcessEnv = process.env): OpenAiBudgetConfig {
  return {
    budgetUsd: optionalNonNegativeNumber('OPENAI_MONTHLY_BUDGET_USD', env.OPENAI_MONTHLY_BUDGET_USD),
    inputCostPer1m: optionalNonNegativeNumber('OPENAI_INPUT_COST_PER_1M', env.OPENAI_INPUT_COST_PER_1M),
    outputCostPer1m: optionalNonNegativeNumber('OPENAI_OUTPUT_COST_PER_1M', env.OPENAI_OUTPUT_COST_PER_1M),
    fallbackRequestEstimateUsd:
      optionalNonNegativeNumber('OPENAI_ESTIMATED_COST_PER_REQUEST_USD', env.OPENAI_ESTIMATED_COST_PER_REQUEST_USD)
      ?? DEFAULT_OPENAI_REQUEST_ESTIMATE_USD
  };
}

export function estimateOpenAiRequestCost(
  input: unknown,
  maxOutputTokens: number,
  config: OpenAiBudgetConfig
) {
  let estimatedCostUsd: number;
  if (config.inputCostPer1m === null || config.outputCostPer1m === null) {
    estimatedCostUsd = roundUsd(config.fallbackRequestEstimateUsd);
  } else {
    // Japanese text can approach one token per character, so use a conservative preflight estimate.
    const inputTokens = Math.max(1, JSON.stringify(input ?? '').length);
    estimatedCostUsd = roundUsd(
      (inputTokens / 1_000_000) * config.inputCostPer1m
        + (Math.max(0, maxOutputTokens) / 1_000_000) * config.outputCostPer1m
    );
  }

  if (config.budgetUsd !== null && estimatedCostUsd <= 0) {
    throw new ServiceUnavailableException(
      'OpenAI月額予算を使う場合、OpenAIの実行前見積額は0より大きい値に設定してください。'
    );
  }
  return estimatedCostUsd;
}

export function assertOpenAiBudgetAvailable(input: {
  budgetUsd: number | null;
  spentUsd: number;
  reservedUsd: number;
  estimatedCostUsd: number;
}) {
  if (input.budgetUsd === null) return;
  const projectedUsd = input.spentUsd + input.reservedUsd + input.estimatedCostUsd;
  if (projectedUsd <= input.budgetUsd) return;

  throw new HttpException(
    `OpenAIの月額予算上限に達するため実行を停止しました。今月の概算利用額 $${roundUsd(input.spentUsd)} / 上限 $${roundUsd(input.budgetUsd)}。ローカル生成は引き続き利用できます。`,
    HttpStatus.TOO_MANY_REQUESTS
  );
}

export function openAiMonthRange(now = new Date()) {
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const inJst = new Date(now.getTime() + jstOffsetMs);
  const year = inJst.getUTCFullYear();
  const month = inJst.getUTCMonth();
  return {
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    start: new Date(Date.UTC(year, month, 1) - jstOffsetMs),
    end: new Date(Date.UTC(year, month + 1, 1) - jstOffsetMs)
  };
}

export function buildOpenAiUsageSummary(input: {
  now?: Date;
  budgetUsd: number | null;
  spentUsd: number;
  reservedUsd: number;
}) {
  const range = openAiMonthRange(input.now);
  const committedUsd = roundUsd(input.spentUsd + input.reservedUsd);
  const remainingUsd = input.budgetUsd === null ? null : roundUsd(Math.max(0, input.budgetUsd - committedUsd));
  const blocked = input.budgetUsd !== null && committedUsd >= input.budgetUsd;

  return {
    provider: 'openai',
    month: range.month,
    configured: input.budgetUsd !== null,
    budgetUsd: input.budgetUsd,
    spentUsd: roundUsd(input.spentUsd),
    reservedUsd: roundUsd(input.reservedUsd),
    remainingUsd,
    usagePercent:
      input.budgetUsd && input.budgetUsd > 0 ? Math.round((committedUsd / input.budgetUsd) * 10_000) / 100 : null,
    blocked,
    statusMessage: input.budgetUsd === null
      ? 'OpenAIの月額予算は未設定です。利用額は記録しますが、自動停止は行いません。'
      : blocked
        ? 'OpenAIの月額予算上限に達しているため、新しいOpenAI実行を停止しています。'
        : `OpenAIの今月の残り予算は概算 $${remainingUsd} です。`
  };
}

export function roundUsd(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 1_000_000) / 1_000_000;
}

function optionalNonNegativeNumber(name: string, raw: string | undefined) {
  if (raw === undefined || raw.trim() === '') return null;
  const value = Number(raw);
  if (Number.isFinite(value) && value >= 0) return value;
  throw new ServiceUnavailableException(`${name} は0以上の数値で設定してください。`);
}
