import { AuthenticationRequiredException, CsrfValidationException } from './auth.exceptions';
import { AuthSecurityGuard } from './auth-security.guard';

describe('AuthSecurityGuard', () => {
  const session = {
    principal: { userId: 'user-1', email: 'user@example.com', role: 'operator', sessionId: 'session-1' },
    csrfToken: 'csrf-token',
    absoluteExpiresAt: new Date('2026-07-20T00:00:00.000Z')
  };

  function context(request: Record<string, unknown>) {
    return {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => request })
    } as any;
  }

  it('allows explicitly public routes without reading a session', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
    const auth = { authenticate: jest.fn(), getConfig: jest.fn() };
    const guard = new AuthSecurityGuard(reflector as any, auth as any);

    await expect(guard.canActivate(context({}))).resolves.toBe(true);
    expect(auth.authenticate).not.toHaveBeenCalled();
  });

  it('attaches the principal and accepts same-origin CSRF on mutations', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const auth = {
      getConfig: jest.fn().mockReturnValue({ cookieName: 'sales_ai_session', allowedOrigin: 'http://127.0.0.1:3000' }),
      authenticate: jest.fn().mockResolvedValue(session)
    };
    const request = {
      method: 'PATCH',
      headers: { cookie: 'sales_ai_session=opaque', origin: 'http://127.0.0.1:3000', 'x-csrf-token': 'csrf-token' }
    };
    const guard = new AuthSecurityGuard(reflector as any, auth as any);

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request).toMatchObject({ authenticatedPrincipal: session.principal, authSession: session });
  });

  it('rejects a mutation without the CSRF token', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const auth = {
      getConfig: jest.fn().mockReturnValue({ cookieName: 'sales_ai_session', allowedOrigin: 'http://127.0.0.1:3000' }),
      authenticate: jest.fn().mockResolvedValue(session)
    };
    const guard = new AuthSecurityGuard(reflector as any, auth as any);

    await expect(guard.canActivate(context({
      method: 'POST',
      headers: { cookie: 'sales_ai_session=opaque', origin: 'http://127.0.0.1:3000' }
    }))).rejects.toBeInstanceOf(CsrfValidationException);
  });

  it('does not treat the removed operator header as authentication', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const auth = {
      getConfig: jest.fn().mockReturnValue({ cookieName: 'sales_ai_session' }),
      authenticate: jest.fn().mockRejectedValue(new AuthenticationRequiredException())
    };
    const guard = new AuthSecurityGuard(reflector as any, auth as any);

    await expect(guard.canActivate(context({
      method: 'GET',
      headers: { 'x-operator-email': 'admin@example.com' }
    }))).rejects.toBeInstanceOf(AuthenticationRequiredException);
    expect(auth.authenticate).toHaveBeenCalledWith(undefined);
  });
});
