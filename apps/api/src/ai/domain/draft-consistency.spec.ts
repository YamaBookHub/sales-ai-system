import { checkDraftConsistency, normalizeText } from './draft-consistency';

describe('draft-consistency', () => {
  const base = {
    companyName: '株式会社テスト食品',
    projectTitle: '燻製サーモンの新商品プロジェクト',
    factsUsed: ['支援額: 1,000,000円', '支援者数: 50人'],
    knownCompanyNames: ['株式会社テスト食品', '別会社株式会社']
  };

  it('normalizes Japanese full-width text and case', () => {
    expect(normalizeText(' ＡＢＣ　株式会社 ')).toBe('abc株式会社');
  });

  it('accepts a matching Japanese draft without warnings', () => {
    const result = checkDraftConsistency({
      ...base,
      body: '株式会社テスト食品 ご担当者様\n燻製サーモンの新商品プロジェクトを拝見しました。\n支援額1,000,000円、支援者数50人の実績を確認しています。\n弊社の支援内容をご案内できます。'
    });
    expect(result.hasWarnings).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it('finds a different company name and missing project keywords', () => {
    const result = checkDraftConsistency({
      ...base,
      body: '別会社株式会社 ご担当者様\n新しいご案内です。\n弊社の支援内容をご案内できます。'
    });
    expect(result.warnings.map((item) => item.code)).toEqual(expect.arrayContaining([
      'recipient_company_mismatch',
      'other_company_name',
      'project_keyword_missing'
    ]));
  });

  it('warns for empty, short, and unfilled template content', () => {
    const result = checkDraftConsistency({ ...base, body: '株式会社テスト食品 ご担当者様 【商品名】' });
    expect(result.warnings.map((item) => item.code)).toEqual(expect.arrayContaining(['body_too_short', 'template_variable_left']));
  });

  it('warns when a numeric claim is not present in factsUsed', () => {
    const result = checkDraftConsistency({
      ...base,
      body: '株式会社テスト食品 ご担当者様\n燻製サーモンの新商品プロジェクトを拝見しました。\n売上3,500万円の実績をご案内します。詳しい内容をご説明できます。'
    });
    expect(result.warnings.some((item) => item.code === 'unsupported_numeric_claim')).toBe(true);
  });
});
