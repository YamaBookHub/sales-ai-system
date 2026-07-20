import { Inject, Injectable } from '@nestjs/common';
import {
  SALES_PERFORMANCE_REPOSITORY,
  SalesPerformanceRepository
} from '../domain/sales-performance.repository';

@Injectable()
export class ListSalesPerformanceOwnersUseCase {
  constructor(
    @Inject(SALES_PERFORMANCE_REPOSITORY)
    private readonly repository: SalesPerformanceRepository
  ) {}

  execute(organizationId: string) {
    return this.repository.listOwners(organizationId);
  }
}
