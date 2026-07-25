import { PATH_METADATA } from '@nestjs/common/constants';
import { REQUIRED_PERMISSIONS } from '../auth/require-permissions.decorator';
import { OperationsController } from './operations.controller';

describe('OperationsController', () => {
  it('keeps the reports route, permission boundary, and current organization contract', async () => {
    const report = { period: { from: '2026-07-01', to: '2026-07-01', timezone: 'Asia/Tokyo', asOf: '2026-07-01T00:00:00.000Z' } };
    const useCase = { execute: jest.fn().mockResolvedValue(report) };
    const controller = new OperationsController(useCase as any);
    const principal = { organizationId: 'org_1' } as any;

    await expect(controller.get(principal, { from: '2026-07-01', to: '2026-07-01' }))
      .resolves.toEqual({ data: report, meta: null, error: null });
    expect(useCase.execute).toHaveBeenCalledWith({ organizationId: 'org_1', from: '2026-07-01', to: '2026-07-01' });
    expect(Reflect.getMetadata(PATH_METADATA, OperationsController)).toBe('reports/operations');
    expect(Reflect.getMetadata(PATH_METADATA, OperationsController.prototype.get)).toBe('/');
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, OperationsController)).toEqual(['reports.read', 'ai.cost.read']);
  });
});
