import { PERMISSIONS, hasPermissions, permissionsForRole } from './permission-policy';

describe('permission policy', () => {
  it('evaluates the complete permission matrix for every role', () => {
    const expected = {
      viewer: ['workspace.read', 'reports.read'],
      operator: ['workspace.read', 'reports.read', 'prospecting.execute', 'records.write', 'analysis.execute', 'opportunity.write'],
      manager: [
        'workspace.read', 'reports.read', 'ai.cost.read', 'prospecting.execute', 'records.write',
        'analysis.execute', 'compliance.manage', 'mail.review', 'mail.queue', 'template.manage',
        'opportunity.write', 'opportunity.reopen'
      ],
      admin: [...PERMISSIONS]
    } as const;

    for (const [role, allowed] of Object.entries(expected)) {
      const allowedSet = new Set<string>(allowed);
      for (const permission of PERMISSIONS) {
        expect(hasPermissions(role as keyof typeof expected, [permission])).toBe(allowedSet.has(permission));
      }
    }
  });

  it('keeps the administrator as the only role with every permission', () => {
    expect(permissionsForRole('admin')).toEqual(PERMISSIONS);
    expect(permissionsForRole('manager')).not.toContain('mail.send');
    expect(permissionsForRole('manager')).not.toContain('user.manage');
  });

  it('allows operators to work but not approve or queue mail', () => {
    expect(hasPermissions('operator', ['records.write', 'analysis.execute'])).toBe(true);
    expect(hasPermissions('operator', ['mail.review'])).toBe(false);
    expect(hasPermissions('operator', ['mail.queue'])).toBe(false);
  });

  it('keeps viewers read-only', () => {
    expect(hasPermissions('viewer', ['workspace.read', 'reports.read'])).toBe(true);
    expect(hasPermissions('viewer', ['records.write'])).toBe(false);
  });
});
