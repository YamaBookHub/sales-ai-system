import { AuthorizationDeniedException } from './auth.exceptions';
import { RbacGuard } from './rbac.guard';
import { IS_PUBLIC_ROUTE } from './public.decorator';
import { REQUIRED_PERMISSIONS } from './require-permissions.decorator';

describe('RbacGuard', () => {
  function context(request: Record<string, unknown>) {
    return {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => request })
    } as any;
  }

  function reflector(required?: string[], isPublic = false) {
    return {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === IS_PUBLIC_ROUTE) return isPublic;
        if (key === REQUIRED_PERMISSIONS) return required;
        return undefined;
      })
    };
  }

  it('allows public routes without a principal', async () => {
    const prisma = { auditLog: { create: jest.fn() } };
    const guard = new RbacGuard(reflector(undefined, true) as any, prisma as any);

    await expect(guard.canActivate(context({}))).resolves.toBe(true);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('fails closed when a protected route has no permission metadata', async () => {
    const prisma = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    const guard = new RbacGuard(reflector() as any, prisma as any);

    await expect(guard.canActivate(context({
      method: 'GET',
      path: '/api/unclassified',
      authenticatedPrincipal: { userId: 'user-1', role: 'admin', sessionId: 'session-1' }
    }))).rejects.toBeInstanceOf(AuthorizationDeniedException);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'user-1', sessionId: 'session-1', action: 'authorization.denied'
    }) });
  });

  it('rejects an operator from manager mail actions and ignores spoofed headers', async () => {
    const prisma = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    const guard = new RbacGuard(reflector(['mail.review']) as any, prisma as any);

    await expect(guard.canActivate(context({
      method: 'POST',
      path: '/api/mails/mail-1/approve',
      headers: { 'x-operator-role': 'admin' },
      authenticatedPrincipal: { userId: 'user-1', role: 'operator', sessionId: 'session-1' }
    }))).rejects.toBeInstanceOf(AuthorizationDeniedException);
  });

  it('allows managers to review and queue mail but not send it', async () => {
    const prisma = { auditLog: { create: jest.fn() } };
    const request = { authenticatedPrincipal: { userId: 'user-1', role: 'manager', sessionId: 'session-1' } };

    await expect(new RbacGuard(reflector(['mail.review']) as any, prisma as any).canActivate(context(request))).resolves.toBe(true);
    await expect(new RbacGuard(reflector(['mail.queue']) as any, prisma as any).canActivate(context(request))).resolves.toBe(true);
    await expect(new RbacGuard(reflector(['mail.send']) as any, prisma as any).canActivate(context(request))).rejects.toBeInstanceOf(AuthorizationDeniedException);
  });
});
