import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { CompaniesModule } from './companies/companies.module';
import { HealthModule } from './health/health.module';
import { LeadsModule } from './leads/leads.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { TrackingModule } from './tracking/tracking.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    CompaniesModule,
    ProjectsModule,
    LeadsModule,
    MailModule,
    AiModule,
    TrackingModule
  ]
})
export class AppModule {}
