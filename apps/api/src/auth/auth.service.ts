import { Inject, Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { AuthConfig } from './auth.config';
import { allSessionTokenHashes, createOpaqueToken, deriveCsrfToken, hashCsrfToken, hashRequestValue, safeEqual } from './auth.crypto';
import { InactiveUserException, AuthenticationRequiredException, AuthorizationDeniedException } from './auth.exceptions';
import { AuthSessionRepository } from './auth-session.repository';
import { AuthenticatedSessionContext, RequestMetadata } from './auth.types';
import { GoogleIdentity, GoogleOidcService } from './google-oidc.service';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_CONFIG } from './auth.tokens';

const ABSOLUTE_SESSION_MS = 24 * 60 * 60 * 1000;
const IDLE_SESSION_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: AuthSessionRepository,
    private readonly googleOidc: GoogleOidcService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig
  ) {}

  getConfig(): AuthConfig {
    return this.config;
  }

  async localLogin(metadata: RequestMetadata = {}): Promise<IssuedSession> {
    if (!this.config.localLoginEnabled || !this.config.devUserEmail) throw new AuthorizationDeniedException();
    const user = await this.prisma.user.findUnique({ where: { email: this.config.devUserEmail } });
    this.assertActiveUser(user);
    return this.issueSession(user, metadata);
  }

  async issueTestSession(userId: string, metadata: RequestMetadata = {}): Promise<IssuedSession> {
    if (process.env.NODE_ENV !== 'test' || this.config.appEnvironment !== 'test' || this.config.authMode !== 'test') {
      throw new AuthorizationDeniedException();
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    this.assertActiveUser(user);
    return this.issueSession(user, metadata);
  }

  async authenticate(sessionToken: string | undefined): Promise<AuthenticatedSessionContext> {
    if (!sessionToken) throw new AuthenticationRequiredException();
    const session = await this.sessions.findActiveByTokenHashes(allSessionTokenHashes(sessionToken, this.config.sessionSecrets), new Date());
    if (!session) throw new AuthenticationRequiredException();
    if (!session.user.isActive || session.user.deletedAt) {
      await this.sessions.revokeAllForUser(session.userId, new Date());
      throw new InactiveUserException();
    }
    const csrfToken = deriveCsrfToken(sessionToken, this.config.csrfSecret);
    if (!safeEqual(hashCsrfToken(csrfToken, this.config.csrfSecret), session.csrfTokenHash)) {
      await this.sessions.revoke(session.id, new Date());
      throw new AuthenticationRequiredException();
    }
    const now = new Date();
    await this.sessions.touchIfNeeded(session.id, session.lastSeenAt, session.absoluteExpiresAt, now);
    return {
      principal: { userId: session.user.id, email: session.user.email, role: session.user.role, sessionId: session.id },
      csrfToken,
      absoluteExpiresAt: session.absoluteExpiresAt
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId, new Date());
  }

  beginGoogleLogin(returnTo: string) {
    return this.googleOidc.begin(returnTo);
  }

  async completeGoogleLogin(code: string | undefined, state: string | undefined, oauthCookie: string | undefined, metadata: RequestMetadata = {}): Promise<{ session: IssuedSession; returnTo: string }> {
    const result = await this.googleOidc.complete(code, state, oauthCookie);
    const user = await this.resolveGoogleUser(result.identity);
    return { session: await this.issueSession(user, metadata), returnTo: result.returnTo };
  }

  getRequestMetadata(headers: Record<string, string | string[] | undefined>): RequestMetadata {
    const forwardedFor = readHeader(headers, 'x-forwarded-for')?.split(',')[0]?.trim();
    const ip = forwardedFor || readHeader(headers, 'x-real-ip');
    return {
      ipHash: hashRequestValue(ip, this.config.sessionSecrets[0]),
      userAgentHash: hashRequestValue(readHeader(headers, 'user-agent'), this.config.sessionSecrets[0])
    };
  }

  private async resolveGoogleUser(identity: GoogleIdentity): Promise<User> {
    const subjectOwner = await this.prisma.user.findUnique({ where: { googleSubject: identity.subject } });
    if (subjectOwner) {
      this.assertActiveUser(subjectOwner);
      return subjectOwner;
    }
    const user = await this.prisma.user.findUnique({ where: { email: identity.email } });
    this.assertActiveUser(user);
    if (user.googleSubject && user.googleSubject !== identity.subject) throw new AuthorizationDeniedException();
    const boundUser = user.googleSubject
      ? user
      : await this.prisma.user.update({
        where: { id: user.id },
        data: { googleSubject: identity.subject, name: user.name || identity.name }
      });
    const verifiedOwner = await this.prisma.user.findUnique({ where: { googleSubject: identity.subject } });
    if (!verifiedOwner || verifiedOwner.id !== boundUser.id) throw new AuthorizationDeniedException();
    return boundUser;
  }

  private async issueSession(user: User, metadata: RequestMetadata): Promise<IssuedSession> {
    const token = createOpaqueToken();
    const csrfToken = deriveCsrfToken(token, this.config.csrfSecret);
    const now = new Date();
    const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_SESSION_MS);
    const idleExpiresAt = new Date(now.getTime() + IDLE_SESSION_MS);
    const session = await this.sessions.create({
      userId: user.id,
      tokenHash: allSessionTokenHashes(token, this.config.sessionSecrets)[0],
      csrfTokenHash: hashCsrfToken(csrfToken, this.config.csrfSecret),
      absoluteExpiresAt,
      idleExpiresAt,
      ipHash: metadata.ipHash,
      userAgentHash: metadata.userAgentHash
    });
    return { id: session.id, token, csrfToken, absoluteExpiresAt };
  }

  private assertActiveUser(user: User | null): asserts user is User {
    if (!user || !user.isActive || user.deletedAt) throw new AuthorizationDeniedException();
  }
}

export type IssuedSession = {
  id: string;
  token: string;
  csrfToken: string;
  absoluteExpiresAt: Date;
};

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name] || headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
