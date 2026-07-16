import {
  buildLunaSalesMailDraftSystemPrompt,
  buildSalesMailDraftSystemPrompt,
  buildSolSalesMailDraftSystemPrompt,
  salesMailPromptProfileForModel
} from './sales-mail-draft.prompt';

describe('sales-mail-draft prompt', () => {
  it('selects the higher-judgment prompt for SOL, its alias, and Gemini Flash', () => {
    expect(salesMailPromptProfileForModel('gpt-5.6-sol')).toBe('sol');
    expect(salesMailPromptProfileForModel('gpt-5.6')).toBe('sol');
    expect(salesMailPromptProfileForModel('gemini-3.5-flash')).toBe('sol');
    expect(buildSalesMailDraftSystemPrompt('gpt-5.6-sol')).toBe(buildSolSalesMailDraftSystemPrompt());
  });

  it('selects the LUNA prompt for the default and lower-cost model names', () => {
    expect(salesMailPromptProfileForModel('gpt-5.6-luna')).toBe('luna');
    expect(salesMailPromptProfileForModel('gemini-3.1-flash-lite')).toBe('luna');
    expect(salesMailPromptProfileForModel('gpt-4.1-mini')).toBe('luna');
    expect(buildSalesMailDraftSystemPrompt()).toBe(buildLunaSalesMailDraftSystemPrompt());
  });

  it('gives SOL room for judgment while keeping the shared output contract', () => {
    const prompt = buildSolSalesMailDraftSystemPrompt();

    expect(prompt).toContain('シニア編集者');
    expect(prompt).toContain('AIらしい抽象表現');
    expect(prompt).toContain('相手のプロジェクトにしか当てはまらない具体的な特徴を1つ');
    expect(prompt).toContain('キーはsubject、body、factsUsed、assumptions、riskFlags');
  });

  it('gives LUNA an explicit sequence and self-check', () => {
    const prompt = buildLunaSalesMailDraftSystemPrompt();

    expect(prompt).toContain('下記の固定順序');
    expect(prompt).toContain('「商品」または「取り組み」');
    expect(prompt).toContain('出力前に、会社名、プロジェクト名、案件種別、魅力、対象者、実績数値、質問数を確認');
    expect(prompt).toContain('もしご関心があれば、今回のプロジェクトに合わせた支援内容を簡単にお送りしますが、いかがでしょうか。');
  });

  it.each([buildSolSalesMailDraftSystemPrompt(), buildLunaSalesMailDraftSystemPrompt()])(
    'explicitly bans generic first-contact and vague closing language',
    (prompt) => {
      expect(prompt).toContain('「お世話になっております」');
      expect(prompt).toContain('「お力になれそうな機会」');
      expect(prompt).toContain('使用しないでください');
    }
  );
});
