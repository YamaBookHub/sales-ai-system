import { Module } from '@nestjs/common';
import { ScoreLeadUseCase } from './application/score-lead.usecase';
import { PrismaLeadRepository } from './infrastructure/prisma-lead.repository';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, ScoreLeadUseCase, PrismaLeadRepository],
  exports: [LeadsService]
})
export class LeadsModule {}
