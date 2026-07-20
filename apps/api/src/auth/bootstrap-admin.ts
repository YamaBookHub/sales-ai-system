import { Prisma, User } from '@prisma/client';

export type BootstrapAdminConfig = {
  enabled: boolean;
  email?: string;
  name?: string;
  organizationSlug?: string;
};

type BootstrapAdminClient = {
  $transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
};

export function readBootstrapAdminConfig(env: NodeJS.ProcessEnv = process.env): BootstrapAdminConfig {
  const enabled = env.AUTH_BOOTSTRAP_ADMIN_ENABLED?.trim().toLowerCase() === 'true';
  if (!enabled) return { enabled: false };

  const email = env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid email when admin bootstrap is enabled.');
  }
  return {
    enabled: true,
    email,
    name: env.BOOTSTRAP_ADMIN_NAME?.trim() || 'System Administrator',
    organizationSlug: env.AUTH_ORGANIZATION_SLUG?.trim().toLowerCase() || 'default'
  };
}

export async function bootstrapAdmin(
  prisma: BootstrapAdminClient,
  config: BootstrapAdminConfig
): Promise<{ status: 'disabled' | 'existing' | 'created'; user?: User }> {
  if (!config.enabled) return { status: 'disabled' };
  if (!config.email || !config.name || !config.organizationSlug) throw new Error('Admin bootstrap configuration is incomplete.');
  const email = config.email;
  const name = config.name;
  const organizationSlug = config.organizationSlug;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      `auth-bootstrap-admin:${organizationSlug}:${email}`
    );
    const organization = await tx.organization.findUnique({ where: { slug: organizationSlug } });
    if (!organization || !organization.isActive) {
      throw new Error('Bootstrap organization does not exist or is inactive. Apply migrations and verify AUTH_ORGANIZATION_SLUG.');
    }
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing) {
      if (!existing.isActive || existing.deletedAt) {
        throw new Error('Bootstrap admin exists but is inactive or deleted. Restore it through an explicit admin procedure.');
      }
      const membership = await tx.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: organization.id, userId: existing.id } }
      });
      if (!membership?.isActive || membership.role !== 'admin') {
        throw new Error('Bootstrap admin email belongs to a non-admin user. Change the role through an explicit admin procedure.');
      }
      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          userId: existing.id,
          action: 'auth.bootstrap_admin.existing',
          entityType: 'User',
          entityId: existing.id,
          after: { role: membership.role, isActive: membership.isActive }
        }
      });
      return { status: 'existing', user: existing };
    }

    const created = await tx.user.create({
      data: { email, name, isActive: true }
    });
    await tx.organizationMembership.create({
      data: {
        organizationId: organization.id,
        userId: created.id,
        displayName: name,
        role: 'admin',
        isActive: true
      }
    });
    await tx.auditLog.create({
      data: {
        organizationId: organization.id,
        userId: created.id,
        action: 'auth.bootstrap_admin.created',
        entityType: 'User',
        entityId: created.id,
        after: { role: 'admin', isActive: true }
      }
    });
    return { status: 'created', user: created };
  });
}
