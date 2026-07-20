import { AuthSessionRepository } from './auth-session.repository';

describe('AuthSessionRepository', () => {
  it('loads only unrevoked sessions before both absolute and idle expiry', async () => {
    const prisma = { userSession: { findFirst: jest.fn().mockResolvedValue(null) } };
    const repository = new AuthSessionRepository(prisma as any);
    const now = new Date('2026-07-19T10:00:00.000Z');

    await repository.findActiveByTokenHashes(['current-hash', 'rotated-hash'], now);

    expect(prisma.userSession.findFirst).toHaveBeenCalledWith({
      where: {
        tokenHash: { in: ['current-hash', 'rotated-hash'] },
        revokedAt: null,
        absoluteExpiresAt: { gt: now },
        idleExpiresAt: { gt: now }
      },
      include: { user: true }
    });
  });
});
