import {
  compareValues,
  labelLeadStatus,
  labelMailStatus,
  labelOpportunityLossReason,
  labelOpportunityStage,
  labelPriority,
  nextActionLabel,
  renderClientViewRulesScript,
  sortItems,
  truncateText
} from './view-rules';

describe('dashboard client view rules', () => {
  it('keeps display labels deterministic', () => {
    expect(labelLeadStatus('replied')).toBe('返信あり');
    expect(labelLeadStatus('archived')).toBe('アーカイブ');
    expect(labelPriority('high')).toBe('高');
    expect(labelMailStatus('in_review')).toBe('確認待ち');
    expect(labelMailStatus('unknown')).toBe('unknown');
    expect(labelOpportunityStage('proposal')).toBe('提案');
    expect(labelOpportunityStage('unknown')).toBe('未取得');
    expect(labelOpportunityLossReason('timing')).toBe('時期が合わない');
    expect(labelOpportunityLossReason('unknown')).toBe('未設定');
  });

  it('keeps next action, sort, and truncation pure', () => {
    expect(nextActionLabel({}, null, false)).toBe('連絡先確認');
    expect(nextActionLabel({}, { status: 'draft' }, true)).toBe('本文確認');
    expect(compareValues('', 'a')).toBeGreaterThan(0);
    expect(sortItems([{ value: 'b' }, { value: '' }, { value: 'a' }], { key: 'value', direction: 'asc' }, (item) => item.value).map((item) => item.value)).toEqual(['a', 'b', '']);
    expect(truncateText('abcdef', 3)).toBe('abc...');
  });

  it('renders a browser-parseable global client module', () => {
    const script = renderClientViewRulesScript();

    expect(script).toContain('window.SalesAiViewRules');
    expect(() => new Function(script)).not.toThrow();
  });
});
