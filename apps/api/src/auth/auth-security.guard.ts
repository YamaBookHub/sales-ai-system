import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { CsrfValidationException } from './auth.exceptions';
import { parseCookies, safeEqual } from './auth.crypto';
import { AuthenticatedRequest } from './auth.types';
import { IS_PUBLIC_ROUTE } from './public.decorator';
import { RequestContextService } from '../common/logging/request-context.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class AuthSecurityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly requestContext: RequestContextService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const config = this.auth.getConfig();
    const cookieHeader = request.headers.cookie;
    const sessionToken = request.cookies?.[config.cookieName] || parseCookies(cookieHeader)[config.cookieName];
    const session = await this.auth.authenticate(sessionToken);
    request.authenticatedPrincipal = session.principal;
    request.authSession = session;
    this.requestContext.setActor(session.principal);

    const method = (request.method || 'GET').toUpperCase();
    if (!SAFE_METHODS.has(method)) {
      this.assertSameOrigin(request, config.allowedOrigin);
      const csrfToken = readHeader(request.headers, 'x-csrf-token');
      if (!csrfToken || !safeEqual(csrfToken, session.csrfToken)) throw new CsrfValidationException();
    }

    return true;
  }

  private assertSameOrigin(request: AuthenticatedRequest, allowedOrigin: string): void {
    const origin = readHeader(request.headers, 'origin');
    if (origin) {
      if (origin !== allowedOrigin) throw new CsrfValidationException();
      return;
    }
    const referer = readHeader(request.headers, 'referer');
    if (!referer) throw new CsrfValidationException();
    try {
      if (new URL(referer).origin !== allowedOrigin) throw new CsrfValidationException();
    } catch {
      throw new CsrfValidationException();
    }
  }
}

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name] || headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
