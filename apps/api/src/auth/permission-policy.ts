import { UserRole } from '@prisma/client';

export const PERMISSIONS = [
  'workspace.read',
  'reports.read',
  'ai.cost.read',
  'prospecting.execute',
  'records.write',
  'analysis.execute',
  'compliance.manage',
  'mail.review',
  'mail.queue',
  'mail.send',
  'template.manage',
  'opportunity.write',
  'opportunity.reopen',
  'user.manage',
  'audit.read'
] as const;

export type Permission = typeof PERMISSIONS[number];

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  viewer: ['workspace.read', 'reports.read'],
  operator: [
    'workspace.read',
    'reports.read',
    'prospecting.execute',
    'records.write',
    'analysis.execute',
    'opportunity.write'
  ],
  manager: [
    'workspace.read',
    'reports.read',
    'ai.cost.read',
    'prospecting.execute',
    'records.write',
    'analysis.execute',
    'compliance.manage',
    'mail.review',
    'mail.queue',
    'template.manage',
    'opportunity.write',
    'opportunity.reopen'
  ],
  admin: PERMISSIONS
};

export function permissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermissions(role: UserRole, required: readonly Permission[]): boolean {
  const granted = new Set(permissionsForRole(role));
  return required.every((permission) => granted.has(permission));
}
