import { validateSync } from 'class-validator';
import { GetOperationsReportQueryDto } from './operations-report.dto';

describe('GetOperationsReportQueryDto', () => {
  it('keeps valid optional period query values for the global whitelist pipe', () => {
    const dto = Object.assign(new GetOperationsReportQueryDto(), {
      from: '2026-07-01',
      to: '2026-07-25'
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto).toEqual({ from: '2026-07-01', to: '2026-07-25' });
  });

  it('rejects non-date-shaped period values before report execution', () => {
    const dto = Object.assign(new GetOperationsReportQueryDto(), {
      from: '2026/07/01',
      to: 'today'
    });

    expect(validateSync(dto).map((error) => Object.values(error.constraints || {}))).toEqual([
      ['開始日はYYYY-MM-DD形式で指定してください。'],
      ['終了日はYYYY-MM-DD形式で指定してください。']
    ]);
  });
});
