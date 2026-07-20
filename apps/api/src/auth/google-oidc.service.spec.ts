import { generateKeyPairSync, sign } from 'crypto';
import type { KeyObject } from 'crypto';
import { Test } from '@nestjs/testing';
import { AuthConfig } from './auth.config';
import { parseCookies, verifySignedJson } from './auth.crypto';
import { AUTH_CONFIG } from './auth.tokens';
import { GoogleOidcService } from './google-oidc.service';

describe('GoogleOidcService', () => {
  const config: AuthConfig = {
    organizationSlug: 'default',
    appEnvironment: 'production',
    authMode: 'google',
    appBaseUrl: new URL('https://sales.example.com'),
    allowedOrigin: 'https://sales.example.com',
    sessionSecrets: ['session-secret-that-is-at-least-thirty-two-characters'],
    csrfSecret: 'csrf-secret-that-is-at-least-thirty-two-characters',
    cookieName: '__Host-sales_ai_session',
    cookieSecure: true,
    localLoginEnabled: false,
    google: {
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
      redirectUri: 'https://sales.example.com/api/auth/google/callback',
      allowedDomains: ['example.com']
    }
  };

  it('uses the global fetch implementation when Nest does not provide an override', async () => {
    const module = await Test.createTestingModule({
      providers: [
        { provide: AUTH_CONFIG, useValue: config },
        GoogleOidcService
      ]
    }).compile();

    expect(module.get(GoogleOidcService)).toBeInstanceOf(GoogleOidcService);
  });

  it('uses PKCE and verifies the signed ID token with mocked Google endpoints', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
    let idToken = '';
    const fetchMock = jest.fn(async (url: string) => {
      if (url.includes('/token')) return { ok: true, status: 200, json: async () => ({ id_token: idToken }) };
      return { ok: true, status: 200, json: async () => ({ keys: [{ ...jwk, kid: 'key-1', alg: 'RS256', use: 'sig' }] }) };
    });
    const service = new GoogleOidcService(config, fetchMock as any);
    const started = service.begin('/leads-view');
    const authorizationUrl = new URL(started.authorizationUrl);
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorizationUrl.searchParams.get('scope')).toBe('openid email profile');

    const signedState = parseCookies(started.cookie)['__Host-sales_ai_oauth'];
    const state = verifySignedJson<{ state: string; nonce: string }>(signedState, config.sessionSecrets)!;
    idToken = jwt(
      { alg: 'RS256', kid: 'key-1' },
      {
        iss: 'https://accounts.google.com',
        aud: config.google!.clientId,
        exp: Math.floor(Date.now() / 1000) + 300,
        iat: Math.floor(Date.now() / 1000),
        nonce: state.nonce,
        sub: 'google-subject-1',
        email: 'USER@example.com',
        email_verified: true,
        name: 'User'
      },
      privateKey
    );

    await expect(service.complete('code-1', state.state, signedState)).resolves.toEqual({
      identity: { subject: 'google-subject-1', email: 'user@example.com', name: 'User' },
      returnTo: '/leads-view'
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function jwt(header: object, payload: object, privateKey: KeyObject): string {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign('RSA-SHA256', Buffer.from(`${encodedHeader}.${encodedPayload}`), privateKey).toString('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
