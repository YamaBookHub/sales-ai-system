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
    expect(draft.body).toContain('突然のご連絡失礼いたします。');
    expect(draft.body).toContain('今回のプロジェクトに合わせた支援内容を簡単にお送りしますが、いかがでしょうか。');
    expect(draft.body).not.toContain('お力になれそうな機会');
    expect(draft.body).not.toContain('自由な本文');
    expect(draft.factsUsed[0]).toBe('取得元: CAMPFIRE');
  });

  it('uses participation language instead of product language for an event project', () => {
    const draft = normalizeOpenAiSalesMailDraft(
      {
        subject: 'AIが作った件名',
        body: '10周年ライブをファンと一緒に実現する点が印象に残りました。',
        factsUsed: [],
        assumptions: [],
        riskFlags: []
      },
      {
        templateKey: 'normal',
        companyName: 'テスト実行委員会',
        projectPlatformName: 'CAMPFIRE',
        projectTitle: '10周年記念ライブ',
        projectDescription: 'ファンと一緒に10周年の記念ライブを実現するプロジェクトです。'
      }
    );

    expect(draft.body).toContain('参加・応援する理由が伝わりやすい取り組み');
    expect(draft.body).not.toContain('実際に使う場面');
    expect(draft.body).not.toContain('担当商品');
  });
});
