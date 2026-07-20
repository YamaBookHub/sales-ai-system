import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const actor = {
    userId: 'admin-1',
    email: 'admin@example.com',
    organizationId: 'org-1',
    organizationSlug: 'org-one',
    role: 'admin' as const,
    sessionId: 'session-1'
  };
  const user = { id: 'user-1', email: 'user@example.com', name: 'User' };
  const current = {
    id: 'membership-1',
    organizationId: actor.organizationId,
    userId: user.id,
    displayName: 'User',
    role: 'operator' as const,
    isActive: true,
    createdAt: new Date('2026-07-20T00:00:00Z'),
    updatedAt: new Date('2026-07-20T00:00:00Z'),
    user
  };

  function setup(overrides: Record<string, unknown> = {}) {
    const membership = {
      findMany: jest.fn().mockResolvedValue([current]),
      findFirst: jest.fn().mockResolvedValue(current),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) => ({ ...current, ...data, user })),
      update: jest.fn().mockImplementation(({ data }: any) => ({ ...current, ...data, user })),
      count: jest.fn().mockResolvedValue(1)
    };
    const tx = {
      $executeRawUnsafe: jest.fn(),
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ ...user, deletedAt: null })
      },
      organizationMembership: membership,
      userSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      ...overrides
    };
    const prisma = {
      ...tx,
      $transaction: jest.fn((input: any) => Array.isArray(input) ? Promise.all(input) : input(tx))
    };
    return { service: new UsersService(prisma as any), prisma, tx, membership };
  }

  it('lists only memberships in the current organization and keeps the existing response shape', async () => {
    const { service, membership } = setup();
    await expect(service.list(2, 50, 'operator', false, actor)).resolves.toMatchObject({
      page: 2,
      limit: 50,
      total: 1,
      items: [{ id: user.id, email: user.email, name: 'User', role: 'operator', isActive: true }]
    });

    expect(membership.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: actor.organizationId, role: 'operator', isActive: false })
    }));
  });

  it('creates a membership in the current organization and records the organization in audit data', async () => {
    const { service, tx, membership } = setup();
    await service.create({ email: ' USER@Example.com ', name: ' User ', role: 'operator' }, actor);

    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { email: 'user@example.com', name: 'User' }
    }));
    expect(membership.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: actor.organizationId, userId: user.id, displayName: 'User', role: 'operator' })
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      organizationId: actor.organizationId,
      userId: actor.userId,
      sessionId: actor.sessionId,
      action: 'organization_membership.created'
    }) });
  });

  it('adds an existing global user to this organization without creating a duplicate user', async () => {
    const existing = { ...user, deletedAt: null };
    const { service, tx } = setup({ user: { findUnique: jest.fn().mockResolvedValue(existing), create: jest.fn() } });
    await service.create({ email: user.email, role: 'viewer' }, actor);

    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.organizationMembership.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: actor.organizationId, userId: user.id, role: 'viewer' })
    }));
  });

  it('rejects adding the same user to the current organization twice', async () => {
    const { service } = setup({
      user: { findUnique: jest.fn().mockResolvedValue({ ...user, deletedAt: null }), create: jest.fn() },
      organizationMembership: { ...setup().membership, findUnique: jest.fn().mockResolvedValue({ id: current.id }) }
    });
    await expect(service.create({ email: user.email, role: 'viewer' }, actor)).rejects.toBeInstanceOf(ConflictException);
  });

  it('revokes only sessions in the current organization when a membership role changes', async () => {
    const { service, tx } = setup();
    await service.update(user.id, { role: 'viewer' }, actor);

    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      `rbac:active-admin:${actor.organizationId}`
    );
    expect(tx.userSession.updateMany).toHaveBeenCalledWith({
      where: { organizationId: actor.organizationId, userId: user.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) }
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      organizationId: actor.organizationId,
      action: 'user.role_changed',
      before: { role: 'operator', isActive: true },
      after: { role: 'viewer', isActive: true }
    }) });
  });

  it('prevents self-demotion and self-deactivation within the current organization', async () => {
    const self = { ...current, userId: actor.userId, user: { ...user, id: actor.userId }, role: 'admin' as const };
    const { service, tx } = setup({
      organizationMembership: { ...setup().membership, findFirst: jest.fn().mockResolvedValue(self) }
    });

    await expect(service.update(actor.userId, { role: 'manager' }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.organizationMembership.update).not.toHaveBeenCalled();
  });

  it('rejects an empty update instead of recording a no-op audit', async () => {
    const { service, prisma } = setup();
    await expect(service.update(user.id, {}, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('prevents changing the final active administrator in this organization only', async () => {
    const admin = { ...current, role: 'admin' as const };
    const { service, tx } = setup({
      organizationMembership: {
        ...setup().membership,
        findFirst: jest.fn().mockResolvedValue(admin),
        count: jest.fn().mockResolvedValue(0)
      }
    });

    await expect(service.update(user.id, { isActive: false }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.organizationMembership.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: actor.organizationId, userId: { not: user.id } })
    }));
    expect(tx.organizationMembership.update).not.toHaveBeenCalled();
  });

  it('returns not found for a user that belongs only to another organization', async () => {
    const { service, tx } = setup({
      organizationMembership: { ...setup().membership, findFirst: jest.fn().mockResolvedValue(null) }
    });

    await expect(service.update(user.id, { role: 'viewer' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.revokeSessions(user.id, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.organizationMembership.update).not.toHaveBeenCalled();
    expect(tx.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('revokes sessions for the selected membership only and records the organization', async () => {
    const { service, tx } = setup();
    await expect(service.revokeSessions(user.id, actor)).resolves.toEqual({ userId: user.id, revokedSessionCount: 2 });
    expect(tx.userSession.updateMany).toHaveBeenCalledWith({
      where: { organizationId: actor.organizationId, userId: user.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) }
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      organizationId: actor.organizationId,
      action: 'organization_membership.sessions_revoked',
      after: { revokedSessionCount: 2 }
    }) });
  });
});
