import { Controller, Get, Post, Query, Redirect, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../common/api-response';
import { AuthService } from './auth.service';
import { clearedOauthCookie, clearedSessionCookie, oauthCookieName, parseCookies, sessionCookie } from './auth.crypto';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';
import { AuthenticatedPrincipal, AuthenticatedRequest } from './auth.types';
import { AuthorizationDeniedException } from './auth.exceptions';
import { permissionsForRole } from './permission-policy';
import { RequirePermissions } from './require-permissions.decorator';

type ResponseLike = {
  setHeader: (name: string, value: string | string[]) => void;
  redirect?: (status: number, location: string) => void;
  status?: (status: number) => ResponseLike;
  type?: (contentType: string) => ResponseLike;
  send?: (body: string) => void;
};

@Controller()
@RequirePermissions('workspace.read')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get('login')
  async login(
    @Query('returnTo') returnTo: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Res() response: ResponseLike,
    @Query('error') error?: string
  ) {
    const destination = safeReturnTo(returnTo);
    const config = this.auth.getConfig();
    const sessionToken = parseCookies(request.headers.cookie)[config.cookieName];
    if (sessionToken) {
      try {
        await this.auth.authenticate(sessionToken);
        response.redirect?.(302, destination);
        return;
      } catch {
        // Invalid or expired sessions fall through to the login page.
      }
    }
    response.status?.(200).type?.('text/html; charset=utf-8').send?.(
      renderLoginPage(config.localLoginEnabled, destination, error === 'not_authorized')
    );
  }

  @Public()
  @Get('auth/google/start')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Redirect()
  googleStart(@Query('returnTo') returnTo: string | undefined, @Res({ passthrough: true }) response: ResponseLike) {
    const started = this.auth.beginGoogleLogin(safeReturnTo(returnTo));
    response.setHeader('Set-Cookie', started.cookie);
    return { url: started.authorizationUrl, statusCode: 302 };
  }

  @Public()
  @Get('auth/google/callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Redirect()
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: ResponseLike
  ) {
    const config = this.auth.getConfig();
    const cookies = parseCookies(request.headers.cookie);
    try {
      const completed = await this.auth.completeGoogleLogin(
        code,
        state,
        cookies[oauthCookieName(config)],
        this.auth.getRequestMetadata(request.headers)
      );
      response.setHeader('Set-Cookie', [
        sessionCookie(completed.session.token, config, secondsUntil(completed.session.absoluteExpiresAt)),
        clearedOauthCookie(config)
      ]);
      return { url: safeReturnTo(completed.returnTo), statusCode: 302 };
    } catch {
      response.setHeader('Set-Cookie', clearedOauthCookie(config));
      return { url: '/login?error=not_authorized', statusCode: 302 };
    }
  }

  @Public()
  @Post('auth/local-login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async localLogin(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: ResponseLike) {
    assertLocalLoginRequest(request, this.auth.getConfig().allowedOrigin);
    const issued = await this.auth.localLogin(this.auth.getRequestMetadata(request.headers));
    response.setHeader(
      'Set-Cookie',
      sessionCookie(issued.token, this.auth.getConfig(), secondsUntil(issued.absoluteExpiresAt))
    );
    return ok({ authenticated: true });
  }

  @Get('auth/me')
  me(@CurrentUser() principal: AuthenticatedPrincipal, @Req() request: AuthenticatedRequest) {
    return ok({
      user: {
        id: principal.userId,
        email: principal.email,
        organizationId: principal.organizationId,
        organizationSlug: principal.organizationSlug,
        role: principal.role,
        permissions: permissionsForRole(principal.role)
      },
      csrfToken: request.authSession!.csrfToken,
      absoluteExpiresAt: request.authSession!.absoluteExpiresAt
    });
  }

  @Post('auth/logout')
  async logout(@CurrentUser() principal: AuthenticatedPrincipal, @Res({ passthrough: true }) response: ResponseLike) {
    await this.auth.logout(principal.sessionId);
    response.setHeader('Set-Cookie', clearedSessionCookie(this.auth.getConfig()));
    return ok({ authenticated: false });
  }
}

const RETURN_PATHS = new Set(['/', '/leads-view', '/mail-workspace', '/today', '/sales-performance', '/replies']);

export function safeReturnTo(value?: string): string {
  if (!value) return '/';
  try {
    const parsed = new URL(value, 'http://localhost');
    if (parsed.origin !== 'http://localhost' || !RETURN_PATHS.has(parsed.pathname)) return '/';
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return '/';
  }
}

function secondsUntil(expiresAt: Date): number {
  return Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
}

function assertLocalLoginRequest(request: AuthenticatedRequest, allowedOrigin: string): void {
  const origin = firstHeader(request.headers.origin);
  const remoteAddress = request.socket?.remoteAddress || '';
  if (!isAllowedLocalOrigin(origin, allowedOrigin) || !isLoopbackAddress(remoteAddress)) {
    throw new AuthorizationDeniedException();
  }
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isAllowedLocalOrigin(origin: string | undefined, allowedOrigin: string): boolean {
  if (!origin) return false;
  if (origin === allowedOrigin) return true;
  try {
    const actual = new URL(origin);
    const allowed = new URL(allowedOrigin);
    return actual.origin === origin
      && actual.protocol === allowed.protocol
      && actual.port === allowed.port
      && isLoopbackHostname(actual.hostname)
      && isLoopbackHostname(allowed.hostname);
  } catch {
    return false;
  }
}

function isLoopbackHostname(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function isLoopbackAddress(value: string): boolean {
  return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';
}

function renderLoginPage(localLoginEnabled: boolean, returnTo: string, loginDenied: boolean): string {
  const action = localLoginEnabled
    ? '<button id="localLoginButton" type="button">ローカル環境でログイン</button>'
    : `<a class="login-button" href="/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}">Googleでログイン</a>`;
  const localScript = localLoginEnabled ? `<script>
    document.getElementById('localLoginButton').addEventListener('click', async function () {
      const status = document.getElementById('loginStatus');
      this.disabled = true;
      status.textContent = 'ログインしています';
      try {
        const response = await fetch('/api/auth/local-login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (!response.ok) throw new Error('ログインできませんでした');
        location.href = ${JSON.stringify(returnTo)};
      } catch (error) {
        status.textContent = error.message || 'ログインできませんでした';
        this.disabled = false;
      }
    });
  </script>` : '';
  const status = loginDenied ? 'ログインを完了できませんでした。利用権限を管理者へ確認してください。' : '';
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ログイン | Sales AI System</title><style>body{margin:0;background:#f4f7f6;color:#17211f;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{width:min(420px,calc(100% - 32px));margin:12vh auto;background:#fff;border:1px solid #d9e2df;padding:32px;border-radius:8px;box-shadow:0 10px 30px rgba(18,45,39,.08)}h1{font-size:24px;margin:0 0 12px}p{color:#64716e;line-height:1.7}.login-button,button{display:block;width:100%;box-sizing:border-box;margin-top:24px;padding:12px 16px;border:0;border-radius:6px;background:#147d6b;color:#fff;font:inherit;font-weight:700;text-align:center;text-decoration:none;cursor:pointer}button:disabled{opacity:.6;cursor:wait}#loginStatus{min-height:24px;margin-top:16px;color:#9a5b00}</style></head><body><main><h1>Sales AI System</h1><p>営業業務を続けるにはログインしてください。</p>${action}<p id="loginStatus" aria-live="polite">${status}</p></main>${localScript}</body></html>`;
}
