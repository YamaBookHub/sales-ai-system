import { buildLocalLeadAnalysis } from './local-lead-analysis';

describe('local-lead-analysis', () => {
  const lead = {
    reason: 'CAMPFIREで食品カテゴリのプロジェクトを確認',
    contactEmail: 'info@example.com',
    contactFormUrl: null,
    siteMessageUrl: null,
    brandWebsiteUrl: 'https://example.com',
    instagramUrl: null,
    tiktokUrl: null,
    xUrl: null,
    brandAnalysisMemo: '商品の魅力: 燻製の香りと食卓で楽しめる点が強みです。',
    snsAnalysisMemo: null,
    company: { name: 'テスト食品株式会社' },
    project: {
      title: '職人仕込みのスモークサーモン',
      platform: { name: 'CAMPFIRE', type: 'campfire' },
      url: 'https://camp-fire.jp/projects/test',
      category: '食品',
      description: '伏流水で仕込んだスモークサーモンを食卓で楽しめます。',
      amount: 1200000,
      supporterCount: 120
    }
  };

  it('builds a local analysis from lead and project facts', () => {
    const result = buildLocalLeadAnalysis(lead);

    expect(result.output.summary).toContain('テスト食品株式会社');
    expect(result.output.summary).toContain('職人仕込みのスモークサーモン');
    expect(result.output.factsUsed).toContain('会社名: テスト食品株式会社');
    expect(result.output.mailPlaceholders.appeal).toContain('燻製');
    expect(result.input.brandAnalysisMemo).toContain('燻製');
  });

  it('drops incompatible manual memos from the analysis input', () => {
    const result = buildLocalLeadAnalysis({
      ...lead,
      brandAnalysisMemo: '米びつの真空保存が魅力です。'
    });

    expect(result.input.brandAnalysisMemo).toBe('');
    expect(result.output.factsUsed.join(' ')).not.toContain('米びつ');
    expect(result.output.mailPlaceholders.appeal).toContain('サーモン');
  });
});
