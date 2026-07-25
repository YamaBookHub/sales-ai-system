import { IsOptional, Matches } from 'class-validator';

export class GetOperationsReportQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '開始日はYYYY-MM-DD形式で指定してください。' })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '終了日はYYYY-MM-DD形式で指定してください。' })
  to?: string;
}
