import { Module } from '@nestjs/common';
import { GetOperationsReportUseCase } from './application/get-operations-report.usecase';
import { OPERATIONS_REPORT_REPOSITORY } from './domain/operations-report.repository';
import { PrismaOperationsReportRepository } from './infrastructure/prisma-operations-report.repository';
import { OperationsController } from './operations.controller';

@Module({
  controllers: [OperationsController],
  providers: [
    PrismaOperationsReportRepository,
    { provide: OPERATIONS_REPORT_REPOSITORY, useExisting: PrismaOperationsReportRepository },
    GetOperationsReportUseCase
  ]
})
export class OperationsModule {}
