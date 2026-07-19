import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import {
  SALES_PERFORMANCE_SOURCES,
  SalesPerformanceSource
} from './domain/sales-performance';

export class GetSalesPerformanceQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsIn(SALES_PERFORMANCE_SOURCES)
  source?: SalesPerformanceSource;
}
