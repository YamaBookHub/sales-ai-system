import { readGmailMailSenderConfig } from './gmail-mail-sender.config';

describe('gmail-mail-sender.config', () => {
  it('reports missing Gmail sender credentials', () => {
    expect(readGmailMailSenderConfig({ GMAIL_CLIENT_ID: 'client' })).toEqual({
      ok: false,
      missing: [
        'clientSecret',
        'refreshToken',
        'fromEmail',
        'appBaseUrl',
        'legalSenderName',
        'legalPostalAddress',
        'legalContactEmail',
        'organizationId'
      ]
    });
  });

  it('reads complete Gmail sender credentials', () => {
    expect(
      readGmailMailSenderConfig({
        GMAIL_CLIENT_ID: ' client ',
        GMAIL_CLIENT_SECRET: ' secret ',
        GMAIL_REFRESH_TOKEN: ' refresh ',
        GMAIL_FROM_EMAIL: 'sales@example.com',
        APP_BASE_URL: 'https://sales.example.com',
        MAIL_LEGAL_SENDER_NAME: '販売会社',
        MAIL_LEGAL_POSTAL_ADDRESS: '東京都千代田区1-1',
        MAIL_LEGAL_CONTACT_EMAIL: 'privacy@example.com',
        MAIL_SENDER_ORGANIZATION_ID: '00000000-0000-4000-8000-000000000007'
      })
    ).toEqual({
      ok: true,
      config: {
        clientId: 'client',
        clientSecret: 'secret',
        refreshToken: 'refresh',
        fromEmail: 'sales@example.com',
        appBaseUrl: 'https://sales.example.com',
        legalSenderName: '販売会社',
        legalPostalAddress: '東京都千代田区1-1',
        legalContactEmail: 'privacy@example.com',
        organizationId: '00000000-0000-4000-8000-000000000007'
      }
    });
  });
});
