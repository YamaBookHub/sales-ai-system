import {
  SalesPerformanceCounts,
  SalesPerformanceSource
} from './sales-performance';

export const SALES_PERFORMANCE_REPOSITORY = Symbol('SALES_PERFORMANCE_REPOSITORY');

export type SalesPerformanceRepositoryInput = {
  organizationId: string;
  startUtc: Date;
  endExclusiveUtc: Date;
  ownerId?: string;
  source?: SalesPerformanceSource;
};

export type SalesPerformanceOwner = {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
};

export interface SalesPerformanceRepository {
  summarize(input: SalesPerformanceRepositoryInput): Promise<SalesPerformanceCounts>;
  listOwners(organizationId: string): Promise<SalesPerformanceOwner[]>;
}
