import { buildLocalMailDraft } from './local-mail-draft';

describe('local-mail-draft', () => {
  it('creates a draft without auto-send language', () => {
    const draft = buildLocalMailDraft({
      templateKey: 'normal',
      companyName: 'テスト株式会社',
      projectPlatformName: 'CAMPFIRE',
      projectTitle: '真空保存できる米びつ',
      projectCategory: 'キッチン',
      projectDescription: 'お米の鮮度を保ちながら分割保存できる米びつです。'
    });

    expect(draft.subject).toBe('CAMPFIREでのプロジェクトを拝見しご連絡いたしました');
    expect(draft.body).toContain('テスト株式会社 ご担当者様');
    expect(draft.body).toContain('真空保存できる米びつ');
    expect(draft.body).toContain('突然のご連絡失礼いたします。');
    expect(draft.body).toContain('今回のプロジェクトに合わせた支援内容を簡単にお送りしますが、いかがでしょうか。');
    expect(draft.body).not.toContain('お力になれそうな機会');
    expect(draft.body).not.toMatch(/送信しました|成果保証|必ず売上/);
    expect(draft.riskFlags[0]).toContain('送信前');
  });

  it('does not use crowdfunding metrics as the appeal', () => {
    const draft = buildLocalMailDraft({
      templateKey: 'normal',
      companyName: 'テスト株式会社',
      projectPlatformName: 'Makuake',
      projectTitle: 'アウトドア用エアベッド',
      projectDescription: '支援額 1,000,000円 支援者数 100人 残り日数 3日。寝心地に配慮したエアベッドです。'
    });

    expect(draft.body).not.toContain('支援額');
    expect(draft.body).not.toContain('支援者数');
    expect(draft.body).not.toContain('残り日数');
    expect(draft.body).toContain('エアベッド');
  });

  it('uses participation language instead of product language for an event project', () => {
    const draft = buildLocalMailDraft({
      templateKey: 'normal',
      companyName: 'テスト実行委員会',
      projectPlatformName: 'CAMPFIRE',
      projectTitle: '10周年記念ライブ',
      projectCategory: '音楽',
      projectDescription: 'ファンと一緒に10周年の記念ライブを実現するプロジェクトです。'
    });

    expect(draft.body).toContain('参加・応援する理由が伝わりやすい取り組み');
    expect(draft.body).not.toContain('実際に使う場面');
    expect(draft.body).not.toContain('担当商品');
  });
});
