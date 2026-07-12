import { renderMailTemplate } from './template-mail-draft';

describe('template-mail-draft', () => {
  it('replaces known variables and reports unresolved variables', () => {
    const result = renderMailTemplate(
      { key: 'custom', subject: '{{companyName}}へのご提案', body: '{{companyName}}様\n{{unknown}}' },
      { companyName: 'テスト株式会社' }
    );

    expect(result.subject).toBe('テスト株式会社へのご提案');
    expect(result.body).toContain('テスト株式会社様');
    expect(result.body).toContain('{{unknown}}');
    expect(result.unresolvedVariables).toEqual(['unknown']);
  });
});
