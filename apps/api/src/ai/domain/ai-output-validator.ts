import { BadGatewayException } from '@nestjs/common';

export type ParsedMailDraft = {
  subject: string;
  body: string;
  factsUsed: string[];
  assumptions: string[];
  riskFlags: string[];
};

export function parseMailDraftJson(content: string): ParsedMailDraft {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new BadGatewayException('OpenAIのメール生成結果がJSON形式ではありませんでした。もう一度お試しください。');
  }

  if (!isMailDraftShape(parsed)) {
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

export function isMailDraftShape(value: unknown): value is ParsedMailDraft {
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
