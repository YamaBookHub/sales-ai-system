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

  it('drops incompatible lead reasons and SNS memos from the analysis input', () => {
    const result = buildLocalLeadAnalysis({
      ...lead,
      reason: '米びつのキッチン収納を訴求できそうな案件です。',
      brandAnalysisMemo: 'ライブの参加体験をファンへ伝えるのが魅力です。',
      snsAnalysisMemo: 'エアベッドを車中泊で使う場面を見せる。'
    });
    const outputText = JSON.stringify(result.output);

    expect(result.input.leadReason).toBe('');
    expect(result.input.brandAnalysisMemo).toBe('');
    expect(result.input.snsAnalysisMemo).toBe('');
    expect(outputText).not.toMatch(/米びつ|キッチン収納|ライブ|エアベッド|車中泊/);
  });

  it('uses material engagement as a sales angle without treating it as a confirmed appointment', () => {
    const result = buildLocalLeadAnalysis({
      ...lead,
      materialEngagement: {
        materialViewed: true,
        materialClickCount: 3,
        lastMaterialClickAt: '2026-07-12T04:00:00.000Z',
        appointmentAngle: 'hot'
      }
    });

    expect(result.input.materialEngagement?.materialClickCount).toBe(3);
    expect(result.output.salesAngles[0]).toContain('複数回閲覧');
    expect(result.output.factsUsed).toContain('会社資料閲覧: 3回 / アポ角度: 非常に高い');
    expect(result.output.riskFlags.join(' ')).toContain('アポ確定');
  });
});
