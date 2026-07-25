import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { GetOperationsReportUseCase } from './get-operations-report.usecase';

describe('GetOperationsReportUseCase', () => {
  const organizationId = 'org_1';
  const now = new Date('2026-07-25T00:00:00.000Z');

  function createUseCase() {
    const repository = {
      summarize: jest.fn().mockResolvedValue({
        aiRows: [], terminalSearches: [], runningSearches: [], imports: [], replies: [], mails: [],
        stuckSendingCount: 0, staleReservedAiCount: 0
      })
    };
    const logger = { errorEvent: jest.fn() };
    return { useCase: new GetOperationsReportUseCase(repository as any, logger as any), repository, logger };
  }

  it('passes only the current organization and resolved period to the repository', async () => {
    const { useCase, repository } = createUseCase();

    await expect(useCase.execute({ organizationId, from: '2026-07-01', to: '2026-07-03' }, now))
      .resolves.toMatchObject({ period: { from: '2026-07-01', to: '2026-07-03' } });

    expect(repository.summarize).toHaveBeenCalledWith(organizationId, expect.objectContaining({
      from: '2026-07-01', to: '2026-07-03', timezone: 'Asia/Tokyo'
    }));
  });

  it('returns Japanese 400 errors for invalid periods without querying the database', async () => {
    const { useCase, repository } = createUseCase();
    await expect(useCase.execute({ organizationId, from: 'bad', to: '2026-07-03' }, now)).rejects.toEqual(
      new BadRequestException('期間はYYYY-MM-DD形式の正しい日付で指定してください。')
    );
    await expect(useCase.execute({ organizationId, from: '2026-07-04', to: '2026-07-03' }, now)).rejects.toEqual(
      new BadRequestException('開始日は終了日以前の日付を指定してください。')
    );
    expect(repository.summarize).not.toHaveBeenCalled();
  });

  it('masks database errors, logs no filters, and returns a generic Japanese 503', async () => {
    const { useCase, repository, logger } = createUseCase();
    repository.summarize.mockRejectedValue(new Error('postgres://admin:secret@example.test failed'));

    await expect(useCase.execute({ organizationId, from: '2026-07-01', to: '2026-07-03' }, now))
      .rejects.toEqual(new ServiceUnavailableException('運用レポートを取得できませんでした。時間をおいて再度お試しください。'));

    expect(logger.errorEvent).toHaveBeenCalledWith('operations.report_failed', {
      organizationId,
      operation: 'operations_report',
      error: expect.any(Error)
    });
    expect(logger.errorEvent.mock.calls[0][1]).not.toHaveProperty('from');
    expect(logger.errorEvent.mock.calls[0][1]).not.toHaveProperty('to');
  });
});
