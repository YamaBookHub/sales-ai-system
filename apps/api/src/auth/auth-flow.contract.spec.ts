import { AuthController } from './auth.controller';
import { AuthSecurityGuard } from './auth-security.guard';
import { AuthConfig } from './auth.config';
import { AuthenticationRequiredException } from './auth.exceptions';
import { AuthService } from './auth.service';
import { permissionsForRole } from './permission-policy';

describe('authenticated session flow contract', () => {
  const user = {
    id: 'user-1',
    email: 'admin@example.com',
    googleSubject: null,
    name: 'Admin',
    role: 'admin',
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const config: AuthConfig = {
    appEnvironment: 'test',
    authMode: 'test',
    appBaseUrl: new URL('http://127.0.0.1:3000'),
    allowedOrigin: 'http://127.0.0.1:3000',
    sessionSecrets: ['test-session-secret'],
    csrfSecret: 'test-csrf-secret',
    cookieName: 'sales_ai_session',
    cookieSecure: false,
    localLoginEnabled: false
  };

  function setup() {
    let storedSession: any;
    const prisma = {
      user: {
        findUnique: jest.fn(({ where }: any) => Promise.resolve(
          where.id === user.id || where.email === user.email ? user : null
        ))
      }
    };
    const sessions = {
      create: jest.fn((input: any) => {
        storedSession = {
          id: 'session-1',
          ...input,
          revokedAt: null,
          lastSeenAt: new Date(),
          user
        };
        return Promise.resolve(storedSession);
      }),
      findActiveByTokenHashes: jest.fn((hashes: string[]) => Promise.resolve(
        storedSession && !storedSession.revokedAt && hashes.includes(storedSession.tokenHash)
          ? storedSession
          : null
      )),
      touchIfNeeded: jest.fn(),
      revoke: jest.fn((sessionId: string, now: Date) => {
        if (storedSession?.id === sessionId) storedSession.revokedAt = now;
        return Promise.resolve();
      }),
      revokeAllForUser: jest.fn()
    };
    const service = new AuthService(prisma as any, sessions as any, {} as any, config);
    const guard = new AuthSecurityGuard({ getAllAndOverride: () => false } as any, service);
    const controller = new AuthController(service);
    return { controller, guard, service, sessions };
  }

  function context(request: Record<string, unknown>) {
    return {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => request })
    } as any;
  }

  it('issues a test session, exposes me, logs out, and rejects token reuse', async () => {
    const { controller, guard, service, sessions } = setup();
    const issued = await service.issueTestSession(user.id);
    const getRequest: any = {
      method: 'GET',
      headers: { cookie: `${config.cookieName}=${issued.token}` }
    };

    await expect(guard.canActivate(context(getRequest))).resolves.toBe(true);
    expect(controller.me(getRequest.authenticatedPrincipal, getRequest)).toEqual({
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          permissions: permissionsForRole(user.role as any)
        },
        csrfToken: issued.csrfToken,
        absoluteExpiresAt: issued.absoluteExpiresAt
      },
      meta: null,
      error: null
    });

    const logoutRequest: any = {
      method: 'POST',
      headers: {
        cookie: `${config.cookieName}=${issued.token}`,
        origin: config.allowedOrigin,
        'x-csrf-token': issued.csrfToken
      }
    };
    await expect(guard.canActivate(context(logoutRequest))).resolves.toBe(true);
    const response = { setHeader: jest.fn() };
    await controller.logout(logoutRequest.authenticatedPrincipal, response);

    expect(sessions.revoke).toHaveBeenCalledWith('session-1', expect.any(Date));
    await expect(guard.canActivate(context(getRequest))).rejects.toBeInstanceOf(AuthenticationRequiredException);
  });

  it('does not allow a legacy identity header to replace a missing session', async () => {
    const { guard } = setup();
    await expect(guard.canActivate(context({
      method: 'GET',
      headers: { 'x-operator-email': user.email }
    }))).rejects.toBeInstanceOf(AuthenticationRequiredException);
  });
});
