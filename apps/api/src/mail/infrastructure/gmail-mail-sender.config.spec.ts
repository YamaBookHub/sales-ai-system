import { readGmailMailSenderConfig } from './gmail-mail-sender.config';

describe('gmail-mail-sender.config', () => {
  it('reports missing Gmail sender credentials', () => {
    expect(readGmailMailSenderConfig({ GMAIL_CLIENT_ID: 'client' })).toEqual({
      ok: false,
      missing: ['clientSecret', 'refreshToken', 'fromEmail']
    });
  });

  it('reads complete Gmail sender credentials', () => {
    expect(
      readGmailMailSenderConfig({
        GMAIL_CLIENT_ID: ' client ',
        GMAIL_CLIENT_SECRET: ' secret ',
        GMAIL_REFRESH_TOKEN: ' refresh ',
        GMAIL_FROM_EMAIL: 'sales@example.com'
      })
    ).toEqual({
      ok: true,
      config: {
        clientId: 'client',
        clientSecret: 'secret',
        refreshToken: 'refresh',
        fromEmail: 'sales@example.com'
      }
    });
  });
});
