import { AuthConfig } from './auth.config';
import { AuthenticationRequiredException, AuthorizationDeniedException, InactiveUserException } from './auth.exceptions';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const config: AuthConfig = {
    appEnvironment: 'local',
    authMode: 'local',
    appBaseUrl: new URL('http://127.0.0.1:3000'),
    allowedOrigin: 'http://127.0.0.1:3000',
    sessionSecrets: ['local-session-secret'],
    csrfSecret: 'local-csrf-secret',
    cookieName: 'sales_ai_session',
    cookieSecure: false,
    localLoginEnabled: true,
    organizationSlug: 'default',
    devUserEmail: 'admin@example.com'
  };
  const user = {
    id: 'user-1',
    email: 'admin@example.com',
    googleSubject: null,
    name: 'Admin',
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const organization = { id: 'org-1', slug: 'default', name: '既定組織', isActive: true };
  const membership = {
    id: 'membership-1', organizationId: organization.id, userId: user.id, displayName: 'Admin',
    role: 'admin', isActive: true, createdAt: new Date(), updatedAt: new Date(), user, organization
  };

  function dependencies() {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn() },
      organizationMembership: {
        findFirst: jest.fn().mockResolvedValue(membership),
        findUnique: jest.fn().mockResolvedValue(membership)
      }
    };
    const sessions = {
      create: jest.fn().mockResolvedValue({ id: 'session-1' }),
      findActiveByTokenHashes: jest.fn(),
      touchIfNeeded: jest.fn(),
      revoke: jest.fn(),
      revokeAllForUser: jest.fn(),
      revokeAllForMembership: jest.fn()
    };
    const google = { begin: jest.fn(), complete: jest.fn() };
    return { prisma, sessions, google };
  }

  it('logs in only the configured local user and stores only token hashes', async () => {
    const { prisma, sessions, google } = dependencies();
    const service = new AuthService(prisma as any, sessions as any, google as any, config);

    const issued = await service.localLogin();

    expect(prisma.organizationMembership.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { user: { email: 'admin@example.com' }, organization: { slug: 'default' } }
    }));
    expect(issued.token).toBeTruthy();
    expect(sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      organizationId: 'org-1',
      tokenHash: expect.any(String),
      csrfTokenHash: expect.any(String)
    }));
    expect(sessions.create.mock.calls[0][0].tokenHash).not.toBe(issued.token);
  });

  it('rejects requests without an opaque session token', async () => {
    const { prisma, sessions, google } = dependencies();
    const service = new AuthService(prisma as any, sessions as any, google as any, config);
    await expect(service.authenticate(undefined)).rejects.toBeInstanceOf(AuthenticationRequiredException);
  });

  it('revokes every session when the user has been disabled', async () => {
    const { prisma, sessions, google } = dependencies();
    sessions.findActiveByTokenHashes.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      organizationId: 'org-1',
      user: { ...user, isActive: false },
      organization,
      membership
    });
    const service = new AuthService(prisma as any, sessions as any, google as any, config);

    await expect(service.authenticate('opaque-token')).rejects.toBeInstanceOf(InactiveUserException);
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-1', expect.any(Date));
    expect(sessions.revokeAllForMembership).not.toHaveBeenCalled();
  });

  it.each([
    ['organization', { organization: { ...organization, isActive: false }, membership }],
    ['membership', { organization, membership: { ...membership, isActive: false } }]
  ])('revokes only the current organization sessions when the %s is inactive', async (_reason, state) => {
    const { prisma, sessions, google } = dependencies();
    sessions.findActiveByTokenHashes.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      organizationId: 'org-1',
      user,
      ...state
    });
    const service = new AuthService(prisma as any, sessions as any, google as any, config);

    await expect(service.authenticate('opaque-token')).rejects.toBeInstanceOf(InactiveUserException);
    expect(sessions.revokeAllForMembership).toHaveBeenCalledWith('org-1', 'user-1', expect.any(Date));
    expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('issues test sessions only through the test-only helper', async () => {
    const { prisma, sessions, google } = dependencies();
    const testConfig: AuthConfig = {
      ...config,
      appEnvironment: 'test',
      authMode: 'test',
      localLoginEnabled: false,
      devUserEmail: undefined
    };
    const service = new AuthService(prisma as any, sessions as any, google as any, testConfig);

    const issued = await service.issueTestSession('user-1', 'org-1');

    expect(prisma.organizationMembership.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId_userId: { organizationId: 'org-1', userId: 'user-1' } }
    }));
    expect(issued.token).toBeTruthy();
    expect(sessions.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
  });

  it('refuses the test session helper outside test auth mode', async () => {
    const { prisma, sessions, google } = dependencies();
    const service = new AuthService(prisma as any, sessions as any, google as any, config);

    await expect(service.issueTestSession('user-1', 'org-1')).rejects.toBeInstanceOf(AuthorizationDeniedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('does not create a user when the configured local identity is unknown', async () => {
    const { prisma, sessions, google } = dependencies();
    prisma.organizationMembership.findFirst.mockResolvedValue(null);
    const service = new AuthService(prisma as any, sessions as any, google as any, config);

    await expect(service.localLogin()).rejects.toBeInstanceOf(AuthorizationDeniedException);
    expect(sessions.create).not.toHaveBeenCalled();
    expect(prisma.user).not.toHaveProperty('create');
  });

  it('rejects an inactive organization membership', async () => {
    const { prisma, sessions, google } = dependencies();
    prisma.organizationMembership.findFirst.mockResolvedValue({ ...membership, isActive: false });
    const service = new AuthService(prisma as any, sessions as any, google as any, config);

    await expect(service.localLogin()).rejects.toBeInstanceOf(AuthorizationDeniedException);
    expect(sessions.create).not.toHaveBeenCalled();
  });
});
