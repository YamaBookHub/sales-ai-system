import { expectedSalesMailSubject } from './mail-draft-rules';

describe('mail-draft-rules', () => {
  it('normalizes subject to the expected platform format', () => {
    expect(expectedSalesMailSubject({ templateKey: 'normal', companyName: 'A社', projectPlatformName: 'Makuake' })).toBe(
      'Makuakeでのプロジェクトを拝見しご連絡いたしました'
    );
  });

  it('uses a safe default platform name', () => {
    expect(expectedSalesMailSubject({ templateKey: 'normal', companyName: 'A社' })).toBe(
      'クラウドファンディングでのプロジェクトを拝見しご連絡いたしました'
    );
  });
});
