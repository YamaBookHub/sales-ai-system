import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { CreateUserDto, UpdateUserDto } from './users.dto';

type MembershipUser = {
  id: string;
  email: string;
  name: string | null;
};

type MembershipRecord = {
  id: string;
  organizationId: string;
  userId: string;
  displayName: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: MembershipUser;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 20, role: UserRole | undefined, isActive: boolean | undefined, actor: AuthenticatedPrincipal) {
    const normalizedPage = Math.max(1, Math.floor(page || 1));
    const normalizedLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));
    const where = {
      organizationId: actor.organizationId,
      user: { deletedAt: null },
      ...(role ? { role } : {}),
      ...(isActive === undefined ? {} : { isActive })
    };
    const prisma = this.prisma as any;
    const [items, total] = await prisma.$transaction([
      prisma.organizationMembership.findMany({
        where,
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit
      }),
      prisma.organizationMembership.count({ where })
    ]);
    return { items: items.map(toUserResponse), page: normalizedPage, limit: normalizedLimit, total };
  }

  async create(dto: CreateUserDto, actor: AuthenticatedPrincipal) {
    const email = dto.email.trim().toLowerCase();
    try {
      return await (this.prisma as any).$transaction(async (tx: any) => {
        let user = await tx.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, deletedAt: true }
        });
        if (user?.deletedAt) throw new ConflictException('このメールアドレスの利用者は利用できません。');
        if (!user) {
          user = await tx.user.create({
            data: { email, name: nullableTrim(dto.name) },
            select: { id: true, email: true, name: true, deletedAt: true }
          });
        }
        const existingMembership = await tx.organizationMembership.findUnique({
          where: { organizationId_userId: { organizationId: actor.organizationId, userId: user.id } },
          select: { id: true }
        });
        if (existingMembership) throw new ConflictException('この利用者はすでに組織へ登録されています。');
        const membership = await tx.organizationMembership.create({
          data: {
            organizationId: actor.organizationId,
            userId: user.id,
            displayName: nullableTrim(dto.name),
            role: dto.role,
            isActive: dto.isActive ?? true
          },
          include: { user: { select: { id: true, email: true, name: true } } }
        });
        const response = toUserResponse(membership);
        await tx.auditLog.create({
          data: {
            organizationId: actor.organizationId,
            userId: actor.userId,
            sessionId: actor.sessionId,
            action: 'organization_membership.created',
            entityType: 'OrganizationMembership',
            entityId: membership.id,
            after: userAuditSnapshot(response)
          }
        });
        return response;
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
    return (this.prisma as any).$transaction(async (tx: any) => {
      // 組織単位で最終管理者の確認と更新を直列化する。
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `rbac:active-admin:${actor.organizationId}`);
      const current = await tx.organizationMembership.findFirst({
        where: { organizationId: actor.organizationId, userId: id, user: { deletedAt: null } },
        include: { user: { select: { id: true, email: true, name: true } } }
      });
      if (!current) throw new NotFoundException('利用者が見つかりません。');

      const nextRole = dto.role ?? current.role;
      const nextActive = dto.isActive ?? current.isActive;
      if (id === actor.userId && (nextRole !== 'admin' || !nextActive)) {
        throw new ConflictException('自分自身の管理者権限または利用状態は変更できません。');
      }
      if (current.role === 'admin' && current.isActive && (nextRole !== 'admin' || !nextActive)) {
        const otherActiveAdmins = await tx.organizationMembership.count({
          where: {
            organizationId: actor.organizationId,
            userId: { not: id },
            role: 'admin',
            isActive: true,
            user: { deletedAt: null, isActive: true }
          }
        });
        if (otherActiveAdmins === 0) throw new ConflictException('最後の有効な管理者は変更できません。');
      }

      const membership = await tx.organizationMembership.update({
        where: { organizationId_userId: { organizationId: actor.organizationId, userId: id } },
        data: {
          ...(Object.prototype.hasOwnProperty.call(dto, 'name') ? { displayName: nullableTrim(dto.name) } : {}),
          ...(dto.role === undefined ? {} : { role: dto.role }),
          ...(dto.isActive === undefined ? {} : { isActive: dto.isActive })
        },
        include: { user: { select: { id: true, email: true, name: true } } }
      });
      const response = toUserResponse(membership);
      const securityChanged = current.role !== membership.role || current.isActive !== membership.isActive;
      if (securityChanged) {
        await tx.userSession.updateMany({
          where: { organizationId: actor.organizationId, userId: id, revokedAt: null },
          data: { revokedAt: new Date() }
        });
      }
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          userId: actor.userId,
          sessionId: actor.sessionId,
          action: userUpdateAction(current, membership),
          entityType: 'OrganizationMembership',
          entityId: membership.id,
          before: userAuditSnapshot(current),
          after: userAuditSnapshot(response)
        }
      });
      return response;
    });
  }

  async revokeSessions(id: string, actor: AuthenticatedPrincipal) {
    return (this.prisma as any).$transaction(async (tx: any) => {
      const membership = await tx.organizationMembership.findFirst({
        where: { organizationId: actor.organizationId, userId: id, user: { deletedAt: null } },
        select: { id: true, userId: true }
      });
      if (!membership) throw new NotFoundException('利用者が見つかりません。');
      const revoked = await tx.userSession.updateMany({
        where: { organizationId: actor.organizationId, userId: id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      await tx.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          userId: actor.userId,
          sessionId: actor.sessionId,
          action: 'organization_membership.sessions_revoked',
          entityType: 'OrganizationMembership',
          entityId: membership.id,
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

function toUserResponse(membership: MembershipRecord) {
  return {
    id: membership.user.id,
    email: membership.user.email,
    name: membership.displayName ?? membership.user.name,
    role: membership.role,
    isActive: membership.isActive,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt
  };
}
