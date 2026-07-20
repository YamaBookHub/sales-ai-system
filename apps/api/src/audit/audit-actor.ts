import { AuthenticatedPrincipal } from '../auth/auth.types';

export type AuditActor = Pick<AuthenticatedPrincipal, 'userId' | 'sessionId'>;

export function auditActor(principal: AuthenticatedPrincipal): AuditActor {
  return { userId: principal.userId, sessionId: principal.sessionId };
}
