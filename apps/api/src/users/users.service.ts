import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { CreateUserDto, UpdateUserDto } from './users.dto';

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 20, role?: UserRole, isActive?: boolean) {
    const normalizedPage = Math.max(1, Math.floor(page || 1));
    const normalizedLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));
    const where = { deletedAt: null, ...(role ? { role } : {}), ...(isActive === undefined ? {} : { isActive }) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, select: userSelect, orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }], skip: (normalizedPage - 1) * normalizedLimit, take: normalizedLimit }),
      this.prisma.user.count({ where })
    ]);
    return { items, page: normalizedPage, limit: normalizedLimit, total };
  }

  async create(dto: CreateUserDto, actor: AuthenticatedPrincipal) {
    const email = dto.email.trim().toLowerCase();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            name: nullableTrim(dto.name),
            role: dto.role,
            isActive: dto.isActive ?? true
          },
          select: userSelect
        });
        await tx.auditLog.create({
          data: {
            userId: actor.userId,
            sessionId: actor.sessionId,
            action: 'user.created',
            entityType: 'User',
            entityId: user.id,
            after: userAuditSnapshot(user)
          }
        });
        return user;
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('このメールアドレスの利用者はすでに登録されています。');
      throw error;
    }
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedPrincipal) {
    if (!Object.keys(dto).some((key) => ['name', 'role', 'isActive'].includes(key))) {
      throw new BadRequestException('変更する項目を1つ以上指定してください。');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', 'rbac:active-admin');
      const current = await tx.user.findFirst({ where: { id, deletedAt: null }, select: userSelect });
      if (!current) throw new NotFoundException('利用者が見つかりません。');

      const nextRole = dto.role ?? current.role;
      const nextActive = dto.isActive ?? current.isActive;
      if (id === actor.userId && (nextRole !== 'admin' || !nextActive)) {
        throw new ConflictException('自分自身の管理者権限または利用状態は変更できません。');
      }
      if (current.role === 'admin' && current.isActive && (nextRole !== 'admin' || !nextActive)) {
        const otherActiveAdmins = await tx.user.count({
          where: { id: { not: id }, role: 'admin', isActive: true, deletedAt: null }
        });
        if (otherActiveAdmins === 0) throw new ConflictException('最後の有効な管理者は変更できません。');
      }

      const user = await tx.user.update({
        where: { id },
        data: {
          ...(Object.prototype.hasOwnProperty.call(dto, 'name') ? { name: nullableTrim(dto.name) } : {}),
          ...(dto.role === undefined ? {} : { role: dto.role }),
          ...(dto.isActive === undefined ? {} : { isActive: dto.isActive })
        },
        select: userSelect
      });
      const securityChanged = current.role !== user.role || current.isActive !== user.isActive;
      if (securityChanged) {
        await tx.userSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          sessionId: actor.sessionId,
          action: userUpdateAction(current, user),
          entityType: 'User',
          entityId: id,
          before: userAuditSnapshot(current),
          after: userAuditSnapshot(user)
        }
      });
      return user;
    });
  }

  async revokeSessions(id: string, actor: AuthenticatedPrincipal) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!user) throw new NotFoundException('利用者が見つかりません。');
      const revoked = await tx.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          sessionId: actor.sessionId,
          action: 'user.sessions_revoked',
          entityType: 'User',
          entityId: id,
          after: { revokedSessionCount: revoked.count }
        }
      });
      return { userId: id, revokedSessionCount: revoked.count };
    });
  }
}

function nullableTrim(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function userAuditSnapshot(user: { role: UserRole; isActive: boolean }) {
  return { role: user.role, isActive: user.isActive };
}

function userUpdateAction(before: { role: UserRole; isActive: boolean }, after: { role: UserRole; isActive: boolean }): string {
  if (before.role !== after.role) return 'user.role_changed';
  if (before.isActive && !after.isActive) return 'user.deactivated';
  if (!before.isActive && after.isActive) return 'user.reactivated';
  return 'user.updated';
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
