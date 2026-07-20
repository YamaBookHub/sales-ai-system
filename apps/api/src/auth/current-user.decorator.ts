import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedPrincipal, AuthenticatedRequest } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.authenticatedPrincipal!;
  }
);
