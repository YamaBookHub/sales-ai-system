import { OperationsPeriod, OperationsReportData } from './operations-report';

export const OPERATIONS_REPORT_REPOSITORY = Symbol('OPERATIONS_REPORT_REPOSITORY');

export interface OperationsReportRepository {
  summarize(organizationId: string, period: OperationsPeriod): Promise<OperationsReportData>;
}
