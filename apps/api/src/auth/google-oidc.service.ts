import { Inject, Injectable } from '@nestjs/common';
import { createHash, createPublicKey, verify } from 'crypto';
import type { JsonWebKey as CryptoJsonWebKey } from 'crypto';
import { AuthConfig } from './auth.config';
import { createOpaqueToken, oauthCookie, signJson, verifySignedJson } from './auth.crypto';
import { AuthorizationDeniedException } from './auth.exceptions';
import { AUTH_CONFIG } from './auth.tokens';

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const OAUTH_TTL_MS = 10 * 60 * 1000;

type OAuthState = {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  expiresAt: number;
};

type GoogleTokenResponse = { id_token?: string };
type GoogleJwk = Record<string, string | string[] | undefined> & { kid?: string; alg?: string; use?: string; kty?: string };
type GoogleJwksResponse = { keys?: GoogleJwk[] };

export type GoogleIdentity = { subject: string; email: string; name?: string };
export type GoogleLoginStart = { authorizationUrl: string; cookie: string };

type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

@Injectable()
export class GoogleOidcService {
  private jwksCache: { expiresAt: number; keys: GoogleJwk[] } | null = null;

  constructor(
    @Inject(AUTH_CONFIG)
    private readonly config: AuthConfig,
    private readonly fetchImpl: FetchLike = globalThis.fetch as FetchLike
  ) {}

  begin(returnTo: string): GoogleLoginStart {
    const google = this.googleConfig();
    const state: OAuthState = {
      state: createOpaqueToken(),
      nonce: createOpaqueToken(),
      verifier: createOpaqueToken(),
      returnTo,
      expiresAt: Date.now() + OAUTH_TTL_MS
    };
    const challenge = base64UrlSha256(state.verifier);
    const url = new URL(GOOGLE_AUTHORIZE_URL);
    url.search = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: google.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: state.state,
      nonce: state.nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    }).toString();
    return {
      authorizationUrl: url.toString(),
      cookie: oauthCookie(signJson(state, this.config.sessionSecrets[0]), this.config)
    };
  }

  async complete(code: string | undefined, stateValue: string | undefined, oauthCookieValue: string | undefined): Promise<{ identity: GoogleIdentity; returnTo: string }> {
    const state = verifySignedJson<OAuthState>(oauthCookieValue, this.config.sessionSecrets);
    if (!code || !state || state.expiresAt <= Date.now() || !safeStringEqual(state.state, stateValue)) {
      throw new AuthorizationDeniedException();
    }
    const token = await this.exchangeCode(code, state.verifier);
    if (!token.id_token) throw new AuthorizationDeniedException();
    const identity = await this.verifyIdToken(token.id_token, state.nonce);
    return { identity, returnTo: state.returnTo };
  }

  async verifyIdToken(idToken: string, expectedNonce: string): Promise<GoogleIdentity> {
    const [encodedHeader, encodedPayload, encodedSignature, ...extra] = idToken.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature || extra.length) throw new AuthorizationDeniedException();
    const header = parseJson<{ alg?: string; kid?: string }>(encodedHeader);
    const claims = parseJson<{
      iss?: string;
      aud?: string | string[];
      exp?: number;
      iat?: number;
      nonce?: string;
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
      name?: string;
    }>(encodedPayload);
    if (!header || !claims || header.alg !== 'RS256' || !header.kid) throw new AuthorizationDeniedException();

    const key = (await this.getJwks()).find((candidate) => candidate.kid === header.kid);
    if (!key || !verify('RSA-SHA256', Buffer.from(`${encodedHeader}.${encodedPayload}`), createPublicKey({ key: key as CryptoJsonWebKey, format: 'jwk' }), Buffer.from(encodedSignature, 'base64url'))) {
      throw new AuthorizationDeniedException();
    }

    const google = this.googleConfig();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const issuerValid = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
    const email = claims.email?.trim().toLowerCase();
    const verified = claims.email_verified === true || claims.email_verified === 'true';
    if (!issuerValid || !audience.includes(google.clientId) || !claims.exp || claims.exp <= nowSeconds || (claims.iat && claims.iat > nowSeconds + 60) || !safeStringEqual(claims.nonce, expectedNonce) || !claims.sub || !email || !verified) {
      throw new AuthorizationDeniedException();
    }
    const domain = email.split('@')[1];
    if (google.allowedDomains.length && (!domain || !google.allowedDomains.includes(domain))) {
      throw new AuthorizationDeniedException();
    }
    return { subject: claims.sub, email, name: claims.name?.trim() || undefined };
  }

  private async exchangeCode(code: string, verifier: string): Promise<GoogleTokenResponse> {
    const google = this.googleConfig();
    const response = await this.fetchImpl(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: google.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier
      }).toString()
    });
    if (!response.ok) throw new AuthorizationDeniedException();
    return (await response.json()) as GoogleTokenResponse;
  }

  private async getJwks(): Promise<GoogleJwk[]> {
    if (this.jwksCache && this.jwksCache.expiresAt > Date.now()) return this.jwksCache.keys;
    const response = await this.fetchImpl(GOOGLE_JWKS_URL);
    if (!response.ok) throw new AuthorizationDeniedException();
    const payload = (await response.json()) as GoogleJwksResponse;
    const keys = payload.keys?.filter((key) => key.kid && key.kty === 'RSA') || [];
    if (!keys.length) throw new AuthorizationDeniedException();
    this.jwksCache = { keys, expiresAt: Date.now() + 60 * 60 * 1000 };
    return keys;
  }

  private googleConfig(): NonNullable<AuthConfig['google']> {
    if (!this.config.google) throw new AuthorizationDeniedException();
    return this.config.google;
  }
}

function parseJson<T>(encoded: string): T | null {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function safeStringEqual(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right || left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

function base64UrlSha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}
