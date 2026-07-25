import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module';
import { CompaniesModule } from './companies/companies.module';
import { ContactsModule } from './contacts/contacts.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { LeadsModule } from './leads/leads.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { TrackingModule } from './tracking/tracking.module';
import { PerformanceModule } from './performance/performance.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { ObservabilityModule } from './common/logging/observability.module';
import { OperationsModule } from './operations/operations.module';
import { LegalModule } from './legal/legal.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 300
      }
    ]),
    ObservabilityModule,
    PrismaModule,
    AuthModule,
    DashboardModule,
    HealthModule,
    LegalModule,
    CompaniesModule,
    ContactsModule,
    ProjectsModule,
    LeadsModule,
    MailModule,
    AiModule,
    TrackingModule,
    PerformanceModule,
    OperationsModule,
    UsersModule,
    AuditModule
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule {}
