import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationDeniedException } from './auth.exceptions';
import { AuthenticatedRequest } from './auth.types';
import { hasPermissions, Permission } from './permission-policy';
import { IS_PUBLIC_ROUTE } from './public.decorator';
import { REQUIRED_PERMISSIONS } from './require-permissions.decorator';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = request.authenticatedPrincipal;
    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS, targets);
    if (principal && required?.length && hasPermissions(principal.role, required)) return true;

    if (principal) {
      try {
        await this.prisma.auditLog.create({
          data: {
            organizationId: principal.organizationId,
            userId: principal.userId,
            sessionId: principal.sessionId,
            action: 'authorization.denied',
            entityType: 'HttpRequest',
            after: {
              method: request.method || 'GET',
              path: request.path || request.originalUrl || '/',
              requiredPermissions: required || []
            }
          }
        });
      } catch {
        // Authorization remains denied even if the audit store is unavailable.
      }
    }
    throw new AuthorizationDeniedException();
  }
}
