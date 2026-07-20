export type AppEnvironment = 'local' | 'test' | 'staging' | 'production';
export type AuthMode = 'local' | 'test' | 'google';

export type AuthConfig = {
  appEnvironment: AppEnvironment;
  authMode: AuthMode;
  appBaseUrl: URL;
  allowedOrigin: string;
  sessionSecrets: string[];
  csrfSecret: string;
  cookieName: string;
  cookieSecure: boolean;
  localLoginEnabled: boolean;
  organizationSlug: string;
  devUserEmail?: string;
  google?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    allowedDomains: string[];
  };
};

const LOCAL_DEFAULT_SECRET = 'local-development-session-secret-change-before-shared-use';
const LOCAL_DEFAULT_CSRF_SECRET = 'local-development-csrf-secret-change-before-shared-use';

export function readAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const appEnvironment = readEnvironment(env);
  const authMode = readAuthMode(env, appEnvironment);
  const appBaseUrl = readAppBaseUrl(env, appEnvironment);
  const sessionSecrets = readSecrets(env.SESSION_SECRETS, appEnvironment, 'SESSION_SECRETS', LOCAL_DEFAULT_SECRET);
  const csrfSecret = readSecret(env.CSRF_SECRET, appEnvironment, 'CSRF_SECRET', LOCAL_DEFAULT_CSRF_SECRET);
  const productionLike = appEnvironment === 'staging' || appEnvironment === 'production';

  if (productionLike && authMode !== 'google') {
    throw new Error('AUTH_MODE must be google in staging and production.');
  }
  if (productionLike && appBaseUrl.protocol !== 'https:') {
    throw new Error('APP_BASE_URL must use HTTPS in staging and production.');
  }
  if ((appEnvironment === 'local' || appEnvironment === 'test') && !isLoopbackHost(appBaseUrl.hostname)) {
    throw new Error('APP_BASE_URL must use a loopback host in local and test environments.');
  }
  if (appEnvironment === 'local' && authMode !== 'local') {
    throw new Error('AUTH_MODE must be local when APP_ENV is local.');
  }
  if (appEnvironment === 'test' && authMode !== 'test') {
    throw new Error('AUTH_MODE must be test when APP_ENV is test.');
  }

  const devUserEmail = normalizeOptionalEmail(env.AUTH_DEV_USER_EMAIL);
  const organizationSlug = normalizeOrganizationSlug(env.AUTH_ORGANIZATION_SLUG);
  if (authMode === 'local' && !devUserEmail) {
    throw new Error('AUTH_DEV_USER_EMAIL is required when AUTH_MODE is local.');
  }

  return {
    appEnvironment,
    authMode,
    appBaseUrl,
    allowedOrigin: appBaseUrl.origin,
    sessionSecrets,
    csrfSecret,
    cookieName: productionLike ? '__Host-sales_ai_session' : 'sales_ai_session',
    cookieSecure: productionLike,
    localLoginEnabled: appEnvironment === 'local' && authMode === 'local',
    organizationSlug,
    devUserEmail,
    google: authMode === 'google' ? readGoogleConfig(env) : undefined
  };
}

function normalizeOrganizationSlug(value: string | undefined): string {
  const normalized = (value || 'default').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(normalized)) {
    throw new Error('AUTH_ORGANIZATION_SLUG must be a valid organization slug.');
  }
  return normalized;
}

export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function readEnvironment(env: NodeJS.ProcessEnv): AppEnvironment {
  const fallback = env.NODE_ENV === 'test' ? 'test' : 'local';
  const value = (env.APP_ENV || fallback).trim().toLowerCase();
  if (value === 'local' || value === 'test' || value === 'staging' || value === 'production') return value;
  throw new Error('APP_ENV must be local, test, staging, or production.');
}

function readAuthMode(env: NodeJS.ProcessEnv, appEnvironment: AppEnvironment): AuthMode {
  const fallback = appEnvironment === 'test' ? 'test' : appEnvironment === 'local' ? 'local' : 'google';
  const value = (env.AUTH_MODE || fallback).trim().toLowerCase();
  if (value === 'local' || value === 'test' || value === 'google') return value;
  throw new Error('AUTH_MODE must be local, test, or google.');
}

function readAppBaseUrl(env: NodeJS.ProcessEnv, appEnvironment: AppEnvironment): URL {
  const defaultHost = env.HOST || '127.0.0.1';
  const defaultPort = env.PORT || '3000';
  const fallback = `http://${defaultHost}:${defaultPort}`;
  try {
    const url = new URL(env.APP_BASE_URL || fallback);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('invalid URL shape');
    }
    return url;
  } catch {
    throw new Error(`APP_BASE_URL is invalid for ${appEnvironment}.`);
  }
}

function readGoogleConfig(env: NodeJS.ProcessEnv): NonNullable<AuthConfig['google']> {
  const clientId = env.GOOGLE_AUTH_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_AUTH_CLIENT_SECRET?.trim();
  const redirectUri = env.GOOGLE_AUTH_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth requires GOOGLE_AUTH_CLIENT_ID, GOOGLE_AUTH_CLIENT_SECRET, and GOOGLE_AUTH_REDIRECT_URI.');
  }
  let callback: URL;
  try {
    callback = new URL(redirectUri);
  } catch {
    throw new Error('GOOGLE_AUTH_REDIRECT_URI is invalid.');
  }
  if (callback.protocol !== 'https:') {
    throw new Error('GOOGLE_AUTH_REDIRECT_URI must use HTTPS.');
  }
  return {
    clientId,
    clientSecret,
    redirectUri: callback.toString(),
    allowedDomains: (env.GOOGLE_ALLOWED_DOMAINS || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  };
}

function readSecrets(value: string | undefined, appEnvironment: AppEnvironment, name: string, fallback: string): string[] {
  const values = (value || (appEnvironment === 'local' || appEnvironment === 'test' ? fallback : ''))
    .split(',')
    .map((secret) => secret.trim())
    .filter(Boolean);
  if (!values.length) throw new Error(`${name} is required.`);
  if ((appEnvironment === 'staging' || appEnvironment === 'production') && values.some((secret) => secret.length < 32)) {
    throw new Error(`${name} entries must be at least 32 characters in staging and production.`);
  }
  return values;
}

function readSecret(value: string | undefined, appEnvironment: AppEnvironment, name: string, fallback: string): string {
  return readSecrets(value, appEnvironment, name, fallback)[0];
}

function normalizeOptionalEmail(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}
