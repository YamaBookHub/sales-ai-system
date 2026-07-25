import { appendMailComplianceFooter, buildUnsubscribeUrl } from './mail-compliance';

describe('mail compliance', () => {
  it('adds sender disclosure and a recipient unsubscribe URL exactly once', () => {
    const input = {
      body: '営業メール本文',
      senderName: '販売会社',
      postalAddress: '東京都千代田区1-1',
      contactEmail: 'privacy@example.com',
      unsubscribeUrl: 'https://sales.example.com/unsubscribe/token'
    };
    const once = appendMailComplianceFooter(input);
    const twice = appendMailComplianceFooter({ ...input, body: once });

    expect(once).toContain('送信者: 販売会社');
    expect(once).toContain('所在地: 東京都千代田区1-1');
    expect(once).toContain('配信停止: https://sales.example.com/unsubscribe/token');
    expect(twice).toBe(once);
  });

  it('builds an origin-bound unsubscribe URL', () => {
    expect(buildUnsubscribeUrl('https://sales.example.com', 'token')).toBe(
      'https://sales.example.com/unsubscribe/token'
    );
  });
});
