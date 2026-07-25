import { readAuthConfig } from './auth.config';

describe('readAuthConfig', () => {
  it('uses only a fixed local user on a loopback origin', () => {
    const config = readAuthConfig({
      APP_ENV: 'local',
      AUTH_MODE: 'local',
      APP_BASE_URL: 'http://127.0.0.1:3000',
      AUTH_DEV_USER_EMAIL: ' Admin@Example.com '
    });

    expect(config.localLoginEnabled).toBe(true);
    expect(config.devUserEmail).toBe('admin@example.com');
    expect(config.cookieName).toBe('sales_ai_session');
    expect(config.cookieSecure).toBe(false);
  });

  it('rejects non-Google authentication in production', () => {
    expect(() => readAuthConfig({
      APP_ENV: 'production',
      AUTH_MODE: 'local',
      APP_BASE_URL: 'https://sales.example.com',
      SESSION_SECRETS: 'a'.repeat(32),
      CSRF_SECRET: 'b'.repeat(32)
    })).toThrow('AUTH_MODE must be google');
  });

  it('requires HTTPS and strong secrets in production', () => {
    expect(() => readAuthConfig({
      APP_ENV: 'production',
      AUTH_MODE: 'google',
      APP_BASE_URL: 'http://sales.example.com',
      SESSION_SECRETS: 'short',
      CSRF_SECRET: 'short'
    })).toThrow();
  });

  it('requires a separate tracking hash secret in production', () => {
    expect(() => readAuthConfig({
      APP_ENV: 'production',
      AUTH_MODE: 'google',
      APP_BASE_URL: 'https://sales.example.com',
      SESSION_SECRETS: 'a'.repeat(32),
      CSRF_SECRET: 'b'.repeat(32),
      LEGAL_OPERATOR_NAME: '販売会社',
      LEGAL_POSTAL_ADDRESS: '東京都千代田区1-1',
      LEGAL_CONTACT_EMAIL: 'privacy@example.com',
      GOOGLE_AUTH_CLIENT_ID: 'client',
      GOOGLE_AUTH_CLIENT_SECRET: 'secret',
      GOOGLE_AUTH_REDIRECT_URI: 'https://sales.example.com/api/auth/google/callback'
    })).toThrow('TRACKING_HASH_SECRET');
  });
});
