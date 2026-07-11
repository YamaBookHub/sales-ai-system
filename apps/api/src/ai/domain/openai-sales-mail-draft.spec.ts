import { compactSalesMailDraftInput, normalizeOpenAiSalesMailDraft } from './openai-sales-mail-draft';

describe('openai-sales-mail-draft', () => {
  const input = {
    templateKey: 'normal',
    companyName: 'テスト食品株式会社',
    projectPlatformName: 'CAMPFIRE',
    projectTitle: '職人仕込みのスモークサーモン',
    projectCategory: '食品',
    projectDescription: '支援額 1,200,000円。伏流水で仕込んだスモークサーモンを食卓で楽しめます。',
    brandAnalysisMemo: '商品の魅力: 燻製の香りと食卓で楽しめる点が強みです。'
  };

  it('compacts prompt input without crowdfunding metrics in description', () => {
    const compacted = compactSalesMailDraftInput(input);

    expect(compacted.project.description).not.toContain('支援額');
    expect(compacted.project.description).toContain('スモークサーモン');
    expect(compacted.brandAnalysisMemo).toContain('燻製');
  });

  it('normalizes the OpenAI draft into the stable sales mail format', () => {
    const draft = normalizeOpenAiSalesMailDraft(
      {
        subject: 'AIが作った件名',
        body: '自由な本文',
        factsUsed: ['プロジェクト名: 職人仕込みのスモークサーモン'],
        assumptions: [],
        riskFlags: []
      },
      input
    );

    expect(draft.subject).toBe('CAMPFIREでのプロジェクトを拝見しご連絡いたしました');
    expect(draft.body).toContain('テスト食品株式会社 ご担当者様');
    expect(draft.body).toContain('職人仕込みのスモークサーモン');
    expect(draft.body).toContain('素材');
    expect(draft.body).not.toContain('自由な本文');
    expect(draft.factsUsed[0]).toBe('取得元: CAMPFIRE');
  });
});
