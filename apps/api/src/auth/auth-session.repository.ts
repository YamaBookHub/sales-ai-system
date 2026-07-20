import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CreateUserSessionInput = {
  organizationId: string;
  userId: string;
  tokenHash: string;
  csrfTokenHash: string;
  absoluteExpiresAt: Date;
  idleExpiresAt: Date;
  ipHash?: string;
  userAgentHash?: string;
};

@Injectable()
export class AuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateUserSessionInput) {
    return this.prisma.userSession.create({ data: input });
  }

  findActiveByTokenHashes(tokenHashes: string[], now: Date) {
    return this.prisma.userSession.findFirst({
      where: {
        tokenHash: { in: tokenHashes },
        revokedAt: null,
        absoluteExpiresAt: { gt: now },
        idleExpiresAt: { gt: now }
      },
      include: { user: true, organization: true, membership: true }
    });
  }

  async touchIfNeeded(sessionId: string, lastSeenAt: Date, absoluteExpiresAt: Date, now: Date): Promise<void> {
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    if (lastSeenAt > fiveMinutesAgo) return;
    const nextIdleExpiry = new Date(Math.min(absoluteExpiresAt.getTime(), now.getTime() + 8 * 60 * 60 * 1000));
    await this.prisma.userSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
        absoluteExpiresAt: { gt: now }
      },
      data: { lastSeenAt: now, idleExpiresAt: nextIdleExpiry }
    });
  }

  async revoke(sessionId: string, now: Date): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now }
    });
  }

  async revokeAllForUser(userId: string, now: Date): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now }
    });
  }

  async revokeAllForMembership(organizationId: string, userId: string, now: Date): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { organizationId, userId, revokedAt: null },
      data: { revokedAt: now }
    });
  }
}
