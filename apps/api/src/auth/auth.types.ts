import { UserRole } from '@prisma/client';

export type AuthenticatedPrincipal = {
  userId: string;
  email: string;
  role: UserRole;
  sessionId: string;
};

export type AuthenticatedRequest = {
  method?: string;
  originalUrl?: string;
  path?: string;
  protocol?: string;
  hostname?: string;
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  socket?: { remoteAddress?: string };
  authenticatedPrincipal?: AuthenticatedPrincipal;
  authSession?: AuthenticatedSessionContext;
};

export type AuthenticatedSessionContext = {
  principal: AuthenticatedPrincipal;
  csrfToken: string;
  absoluteExpiresAt: Date;
};

export type RequestMetadata = {
  ipHash?: string;
  userAgentHash?: string;
};
