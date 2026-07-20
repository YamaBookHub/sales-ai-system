import { BadRequestException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const actor = { userId: 'admin-1', email: 'admin@example.com', role: 'admin' as const, sessionId: 'session-1' };
  const current = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    role: 'operator' as const,
    isActive: true,
    createdAt: new Date('2026-07-20T00:00:00Z'),
    updatedAt: new Date('2026-07-20T00:00:00Z')
  };

  function setup(overrides: Record<string, unknown> = {}) {
    const tx = {
      $executeRawUnsafe: jest.fn(),
      user: {
        findFirst: jest.fn().mockResolvedValue(current),
        create: jest.fn().mockImplementation(({ data }: any) => ({ ...current, ...data })),
        update: jest.fn().mockImplementation(({ data }: any) => ({ ...current, ...data })),
        count: jest.fn().mockResolvedValue(1)
      },
      userSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      ...overrides
    };
    const prisma = { $transaction: jest.fn((callback: any) => callback(tx)) };
    return { service: new UsersService(prisma as any), prisma, tx };
  }

  it('creates a user and records the authenticated actor and session', async () => {
    const { service, tx } = setup();
    await service.create({ email: ' USER@Example.com ', name: ' User ', role: 'operator' }, actor);

    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: 'user@example.com', name: 'User', role: 'operator' })
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: actor.userId,
      sessionId: actor.sessionId,
      action: 'user.created'
    }) });
    expect(JSON.stringify(tx.auditLog.create.mock.calls[0][0])).not.toContain('user@example.com');
    expect(tx.auditLog.create.mock.calls[0][0].data.after).toEqual({ role: 'operator', isActive: true });
  });

  it('revokes every session when a role changes and records before and after', async () => {
    const { service, tx } = setup();
    await service.update(current.id, { role: 'viewer' }, actor);

    expect(tx.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: current.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) }
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: 'user.role_changed',
      before: expect.objectContaining({ role: 'operator' }),
      after: expect.objectContaining({ role: 'viewer' })
    }) });
  });

  it('prevents self-demotion and self-deactivation', async () => {
    const self = { ...current, id: actor.userId, role: 'admin' as const };
    const { service, tx } = setup({
      user: {
        findFirst: jest.fn().mockResolvedValue(self),
        update: jest.fn(),
        count: jest.fn()
      }
    });

    await expect(service.update(actor.userId, { role: 'manager' }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('rejects an empty update instead of recording a no-op audit', async () => {
    const { service, prisma } = setup();
    await expect(service.update(current.id, {}, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('prevents changing the final active administrator', async () => {
    const admin = { ...current, role: 'admin' as const };
    const { service, tx } = setup({
      user: {
        findFirst: jest.fn().mockResolvedValue(admin),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0)
      }
    });

    await expect(service.update(admin.id, { isActive: false }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('revokes sessions explicitly and audits the count', async () => {
    const { service, tx } = setup();
    await expect(service.revokeSessions(current.id, actor)).resolves.toEqual({ userId: current.id, revokedSessionCount: 2 });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: 'user.sessions_revoked',
      after: { revokedSessionCount: 2 }
    }) });
  });
});
