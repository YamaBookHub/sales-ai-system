import { BadGatewayException } from '@nestjs/common';

export type SemanticConsistencyInput = {
  companyName: string;
  projectTitle?: string | null;
  projectCategory?: string | null;
  projectDescription?: string | null;
  body?: string | null;
  factsUsed?: string[];
};

export type SemanticConsistencyResult = {
  matchesProject: boolean;
  suspectedForeignFacts: string[];
  reason: string;
  confidence: number;
};

export const SEMANTIC_CONSISTENCY_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    matchesProject: { type: 'boolean' },
    suspectedForeignFacts: { type: 'array', items: { type: 'string' } },
    reason: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 }
  },
  required: ['matchesProject', 'suspectedForeignFacts', 'reason', 'confidence']
};

export function parseSemanticConsistencyJson(content: string): SemanticConsistencyResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new BadGatewayException('AIの意味整合性確認結果がJSON形式ではありませんでした。');
  }

  if (!isSemanticConsistencyResult(parsed)) {
    throw new BadGatewayException('AIの意味整合性確認結果に必要な項目が不足しています。');
  }

  return {
    matchesProject: parsed.matchesProject,
    suspectedForeignFacts: parsed.suspectedForeignFacts.map((item) => item.trim()).filter(Boolean),
    reason: parsed.reason.trim(),
    confidence: parsed.confidence
  };
}

function isSemanticConsistencyResult(value: unknown): value is SemanticConsistencyResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.matchesProject === 'boolean' &&
    Array.isArray(result.suspectedForeignFacts) &&
    result.suspectedForeignFacts.every((item) => typeof item === 'string') &&
    typeof result.reason === 'string' &&
    result.reason.trim().length > 0 &&
    typeof result.confidence === 'number' &&
    Number.isFinite(result.confidence) &&
    result.confidence >= 0 &&
    result.confidence <= 1
  );
}
