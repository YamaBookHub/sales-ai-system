export interface ViewRuleLead {
  contactEmail?: unknown;
  contactFormUrl?: unknown;
  siteMessageUrl?: unknown;
  status?: unknown;
}

export interface ViewRuleMail {
  status?: unknown;
}

export interface ViewRuleSort {
  key?: string;
  direction?: string;
}

export function labelLeadStatus(status: unknown): string {
  return ({
    discovered: '発見',
    qualified: '候補',
    drafted: '下書き済み',
    reviewing: '確認中',
    approved: '承認済み',
    queued: '送信待ち',
    contacted: '連絡済み',
    replied: '返信あり',
    meeting_candidate: '商談候補',
    rejected: '対象外',
    no_response: '返信なし',
    archived: 'アーカイブ'
  } as Record<string, string>)[String(status)] || String(status || '未設定');
}

export function labelPriority(priority: unknown): string {
  return ({ high: '高', medium: '中', low: '低' } as Record<string, string>)[String(priority)] || String(priority || '未設定');
}

export function labelMailStatus(status: unknown): string {
  return ({
    draft: '下書き',
    in_review: '確認待ち',
    rejected: '棄却',
    approved: '承認済み',
    queued: '送信待ち',
    sending: '送信中',
    sent: '送信済み',
    failed: '送信失敗',
    cancelled: 'キャンセル'
  } as Record<string, string>)[String(status)] || String(status || '未設定');
}

export function compareValues(left: unknown, right: unknown): number {
  const leftEmpty = left === null || left === undefined || left === '';
  const rightEmpty = right === null || right === undefined || right === '';
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), 'ja', { numeric: true, sensitivity: 'base' });
}

export function sortItems<T>(
  items: T[],
  sort: ViewRuleSort | undefined,
  valueGetter: (item: T, key: string) => unknown,
  compare = compareValues
): T[] {
  if (!sort?.key) return items;
  const direction = sort.direction === 'desc' ? -1 : 1;
  return [...items].sort((left, right) => compare(valueGetter(left, sort.key as string), valueGetter(right, sort.key as string)) * direction);
}

export function nextActionLabel(lead: ViewRuleLead, mail: ViewRuleMail | null | undefined, hasContact: boolean): string {
  if (!hasContact) return '連絡先確認';
  if (!mail) return 'AI分析後にメール生成';
  if (mail.status === 'draft') return '本文確認';
  if (mail.status === 'in_review') return '上長確認';
  if (mail.status === 'rejected') return '修正して再依頼';
  if (mail.status === 'approved') return 'キュー投入';
  if (mail.status === 'queued') return '送信待ち';
  if (mail.status === 'sent') return '返信確認';
  return '確認';
}

export function truncateText(value: unknown, maxLength: number): string {
  const text = String(value || '');
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

export function renderClientViewRulesScript(): string {
  const functions = {
    labelLeadStatus,
    labelPriority,
    labelMailStatus,
    compareValues,
    sortItems,
    nextActionLabel,
    truncateText
  };
  return 'window.SalesAiViewRules = {\n' + Object.entries(functions)
    .map(([name, implementation]) => '  ' + name + ': ' + implementation.toString())
    .join(',\n') + '\n};';
}
