import type { SalesMailDraftInput } from './openai-sales-mail-draft';

export function expectedSalesMailSubject(input?: SalesMailDraftInput) {
  const platformName = cleanPhrase(input?.projectPlatformName) || 'クラウドファンディング';
  return `${platformName}でのプロジェクトを拝見しご連絡いたしました`;
}

export function cleanPhrase(value: string | null | undefined) {
  return (value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[・、。]+/, '')
    .replace(/[。]+$/, '')
    .trim();
}
