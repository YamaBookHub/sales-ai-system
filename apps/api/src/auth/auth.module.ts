import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthExceptionFilter } from './auth-exception.filter';
import { AuthSecurityGuard } from './auth-security.guard';
import { AuthSessionRepository } from './auth-session.repository';
import { readAuthConfig } from './auth.config';
import { AuthService } from './auth.service';
import { AUTH_CONFIG } from './auth.tokens';
import { GoogleOidcService } from './google-oidc.service';
import { RbacGuard } from './rbac.guard';

@Module({
  controllers: [AuthController],
  providers: [
    { provide: AUTH_CONFIG, useFactory: readAuthConfig },
    AuthSessionRepository,
    GoogleOidcService,
    AuthService,
    { provide: APP_GUARD, useClass: AuthSecurityGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_FILTER, useClass: AuthExceptionFilter }
  ],
  exports: [AuthService]
})
export class AuthModule {}
