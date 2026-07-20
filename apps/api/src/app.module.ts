import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    DashboardModule,
    HealthModule,
    CompaniesModule,
    ContactsModule,
    ProjectsModule,
    LeadsModule,
    MailModule,
    AiModule,
    TrackingModule,
    PerformanceModule,
    UsersModule,
    AuditModule
  ]
})
export class AppModule {}
