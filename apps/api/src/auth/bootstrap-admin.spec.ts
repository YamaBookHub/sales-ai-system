import { bootstrapAdmin, readBootstrapAdminConfig } from './bootstrap-admin';

describe('bootstrapAdmin', () => {
  const admin = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'admin@example.com',
    googleSubject: null,
    name: 'Admin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  } as const;
  const organization = { id: 'org-1', slug: 'default', name: '既定組織', isActive: true } as const;
  const adminMembership = {
    id: 'membership-1', organizationId: organization.id, userId: admin.id,
    displayName: admin.name, role: 'admin', isActive: true
  } as const;

  function setup(existing: typeof admin | null = null, membership: typeof adminMembership | { role: 'operator' } | null = existing ? adminMembership : null) {
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      organization: { findUnique: jest.fn().mockResolvedValue(organization) },
      organizationMembership: {
        findUnique: jest.fn().mockResolvedValue(membership),
        create: jest.fn().mockResolvedValue(adminMembership)
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create: jest.fn().mockResolvedValue(admin)
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    return {
      tx,
      prisma: { $transaction: jest.fn((callback) => callback(tx)) }
    };
  }

  it('requires an explicit flag and normalizes the configured email', () => {
    expect(readBootstrapAdminConfig({})).toEqual({ enabled: false });
    expect(readBootstrapAdminConfig({
      AUTH_BOOTSTRAP_ADMIN_ENABLED: 'true',
      BOOTSTRAP_ADMIN_EMAIL: ' Admin@Example.com ',
      BOOTSTRAP_ADMIN_NAME: ' 管理者 '
    })).toEqual({ enabled: true, email: 'admin@example.com', name: '管理者', organizationSlug: 'default' });
  });

  it('creates an admin once under an advisory lock and records the result', async () => {
    const { prisma, tx } = setup();

    await expect(bootstrapAdmin(prisma as any, {
      enabled: true,
      email: 'admin@example.com',
      name: 'Admin',
      organizationSlug: 'default'
    })).resolves.toMatchObject({ status: 'created', user: admin });

    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      'auth-bootstrap-admin:default:admin@example.com'
    );
    expect(tx.user.create).toHaveBeenCalledWith({
      data: { email: 'admin@example.com', name: 'Admin', isActive: true }
    });
    expect(tx.organizationMembership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: organization.id, userId: admin.id, role: 'admin' })
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'auth.bootstrap_admin.created', userId: admin.id })
    });
    expect(JSON.stringify(tx.auditLog.create.mock.calls[0][0])).not.toContain(admin.email);
    expect(JSON.stringify(tx.auditLog.create.mock.calls[0][0])).not.toContain(admin.name);
  });

  it('does not reactivate or promote an existing user', async () => {
    const inactive = { ...admin, isActive: false };
    const operatorMembership = { ...adminMembership, role: 'operator' as const };

    await expect(bootstrapAdmin(setup(inactive as any).prisma as any, {
      enabled: true, email: admin.email, name: admin.name, organizationSlug: 'default'
    })).rejects.toThrow('inactive or deleted');
    await expect(bootstrapAdmin(setup(admin, operatorMembership).prisma as any, {
      enabled: true, email: admin.email, name: admin.name, organizationSlug: 'default'
    })).rejects.toThrow('non-admin user');
  });
});
