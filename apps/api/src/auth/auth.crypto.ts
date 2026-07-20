import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { AuthConfig } from './auth.config';

export type SignedValue<T> = { payload: T; signature: string };

export function createOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string, secret: string): string {
  return hmac(secret, `session:${token}`);
}

export function hashCsrfToken(token: string, secret: string): string {
  return hmac(secret, `csrf:${token}`);
}

export function deriveCsrfToken(sessionToken: string, csrfSecret: string): string {
  return hmac(csrfSecret, `csrf-session:${sessionToken}`);
}

export function hashRequestValue(value: string | undefined, secret: string): string | undefined {
  return value ? hmac(secret, `request:${value}`) : undefined;
}

export function allSessionTokenHashes(token: string, secrets: string[]): string[] {
  return secrets.map((secret) => hashSessionToken(token, secret));
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function signJson<T>(payload: T, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${hmac(secret, `signed:${encoded}`)}`;
}

export function verifySignedJson<T>(value: string | undefined, secrets: string[]): T | null {
  if (!value) return null;
  const [encoded, signature, ...extra] = value.split('.');
  if (!encoded || !signature || extra.length) return null;
  const valid = secrets.some((secret) => safeEqual(signature, hmac(secret, `signed:${encoded}`)));
  if (!valid) return null;
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function sessionCookie(value: string, config: AuthConfig, maxAgeSeconds: number): string {
  return serializeCookie(config.cookieName, value, {
    maxAgeSeconds,
    secure: config.cookieSecure,
    httpOnly: true,
    sameSite: 'Lax'
  });
}

export function clearedSessionCookie(config: AuthConfig): string {
  return serializeCookie(config.cookieName, '', {
    maxAgeSeconds: 0,
    secure: config.cookieSecure,
    httpOnly: true,
    sameSite: 'Lax'
  });
}

export function oauthCookieName(config: AuthConfig): string {
  return config.cookieSecure ? '__Host-sales_ai_oauth' : 'sales_ai_oauth';
}

export function oauthCookie(value: string, config: AuthConfig): string {
  return serializeCookie(oauthCookieName(config), value, {
    maxAgeSeconds: 10 * 60,
    secure: config.cookieSecure,
    httpOnly: true,
    sameSite: 'Lax'
  });
}

export function clearedOauthCookie(config: AuthConfig): string {
  return serializeCookie(oauthCookieName(config), '', {
    maxAgeSeconds: 0,
    secure: config.cookieSecure,
    httpOnly: true,
    sameSite: 'Lax'
  });
}

export function parseCookies(header: string | string[] | undefined): Record<string, string> {
  const source = Array.isArray(header) ? header.join(';') : header || '';
  return source.split(';').reduce<Record<string, string>>((cookies, segment) => {
    const equalsIndex = segment.indexOf('=');
    if (equalsIndex <= 0) return cookies;
    const key = segment.slice(0, equalsIndex).trim();
    const value = segment.slice(equalsIndex + 1).trim();
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      // Ignore malformed cookie fragments and continue with the remaining cookies.
    }
    return cookies;
  }, {});
}

function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function serializeCookie(
  name: string,
  value: string,
  options: { maxAgeSeconds: number; secure: boolean; httpOnly: boolean; sameSite: 'Lax' }
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', `Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`];
  if (options.httpOnly) parts.push('HttpOnly');
  parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}
