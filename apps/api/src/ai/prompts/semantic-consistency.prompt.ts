import type { SemanticConsistencyInput } from '../domain/semantic-consistency';

export function buildSemanticConsistencySystemPrompt() {
  return [
    'あなたは営業メールの品質確認担当です。',
    '会社、案件、本文、factsUsedを比較し、本文が選択案件に意味的に合っているかを確認してください。',
    '別案件の特徴や実績が混ざっている疑いがあれば suspectedForeignFacts に短く列挙してください。',
    '不明な場合は matchesProject を false 寄りにし、confidence を下げてください。',
    '人間の確認を置き換えず、断定ではなく確認のための助言として返してください。'
  ].join('\n');
}

export function compactSemanticConsistencyInput(input: SemanticConsistencyInput) {
  return {
    companyName: input.companyName,
    projectTitle: limit(input.projectTitle),
    projectCategory: limit(input.projectCategory),
    projectDescription: limit(input.projectDescription, 1800),
    body: limit(input.body, 4000),
    factsUsed: (input.factsUsed || []).slice(0, 30)
  };
}

function limit(value?: string | null, max = 1200) {
  return String(value || '').slice(0, max);
}
