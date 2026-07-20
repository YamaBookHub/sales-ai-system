import { SetMetadata } from '@nestjs/common';
import { Permission } from './permission-policy';

export const REQUIRED_PERMISSIONS = 'auth:required-permissions';

export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(REQUIRED_PERMISSIONS, permissions);
