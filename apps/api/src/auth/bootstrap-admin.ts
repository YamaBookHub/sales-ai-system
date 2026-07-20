import { Prisma, User } from '@prisma/client';

export type BootstrapAdminConfig = {
  enabled: boolean;
  email?: string;
  name?: string;
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
    name: env.BOOTSTRAP_ADMIN_NAME?.trim() || 'System Administrator'
  };
}

export async function bootstrapAdmin(
  prisma: BootstrapAdminClient,
  config: BootstrapAdminConfig
): Promise<{ status: 'disabled' | 'existing' | 'created'; user?: User }> {
  if (!config.enabled) return { status: 'disabled' };
  if (!config.email || !config.name) throw new Error('Admin bootstrap configuration is incomplete.');
  const email = config.email;
  const name = config.name;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      `auth-bootstrap-admin:${email}`
    );
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing) {
      if (!existing.isActive || existing.deletedAt) {
        throw new Error('Bootstrap admin exists but is inactive or deleted. Restore it through an explicit admin procedure.');
      }
      if (existing.role !== 'admin') {
        throw new Error('Bootstrap admin email belongs to a non-admin user. Change the role through an explicit admin procedure.');
      }
      await tx.auditLog.create({
        data: {
          userId: existing.id,
          action: 'auth.bootstrap_admin.existing',
          entityType: 'User',
          entityId: existing.id,
          after: { role: existing.role, isActive: existing.isActive }
        }
      });
      return { status: 'existing', user: existing };
    }

    const created = await tx.user.create({
      data: { email, name, role: 'admin', isActive: true }
    });
    await tx.auditLog.create({
      data: {
        userId: created.id,
        action: 'auth.bootstrap_admin.created',
        entityType: 'User',
        entityId: created.id,
        after: { role: created.role, isActive: created.isActive }
      }
    });
    return { status: 'created', user: created };
  });
}
