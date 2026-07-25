import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import {
  buildOperationsReport,
  OperationsPeriodError,
  resolveOperationsPeriod
} from '../domain/operations-report';
import {
  OPERATIONS_REPORT_REPOSITORY,
  OperationsReportRepository
} from '../domain/operations-report.repository';

export type GetOperationsReportInput = {
  organizationId: string;
  from?: string;
  to?: string;
};

@Injectable()
export class GetOperationsReportUseCase {
  constructor(
    @Inject(OPERATIONS_REPORT_REPOSITORY)
    private readonly repository: OperationsReportRepository,
    private readonly logger: StructuredLogger
  ) {}

  async execute(input: GetOperationsReportInput, now = new Date()) {
    let period;
    try {
      period = resolveOperationsPeriod(input, now);
    } catch (error) {
      throw periodException(error);
    }

    try {
      const data = await this.repository.summarize(input.organizationId, period);
      return buildOperationsReport(period, data);
    } catch (error) {
      this.logger.errorEvent('operations.report_failed', {
        organizationId: input.organizationId,
        operation: 'operations_report',
        error
      });
      throw new ServiceUnavailableException('運用レポートを取得できませんでした。時間をおいて再度お試しください。');
    }
  }
}

function periodException(error: unknown) {
  if (!(error instanceof OperationsPeriodError)) throw error;
  if (error.code === 'reversed_range') return new BadRequestException('開始日は終了日以前の日付を指定してください。');
  if (error.code === 'range_too_long') return new BadRequestException('期間は最大90日まで指定できます。');
  return new BadRequestException('期間はYYYY-MM-DD形式の正しい日付で指定してください。');
}
