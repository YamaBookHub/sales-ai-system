import { PATH_METADATA } from '@nestjs/common/constants';
import { SalesPerformanceController } from './sales-performance.controller';

describe('SalesPerformanceController', () => {
  const principal = { organizationId: 'org_1' } as any;

  it('keeps the aggregate API route stable and wraps the usecase response', async () => {
    const report = {
      period: { from: '2026-07-01', to: '2026-07-31', timezone: 'Asia/Tokyo' },
      counts: { sentMessages: 1, contactedLeads: 1 },
      rates: { replyRate: 0, meetingRate: 0, wonRate: 0 },
      lossReasons: []
    };
    const usecase = { execute: jest.fn().mockResolvedValue(report) };
    const owners = { execute: jest.fn() };
    const controller = new SalesPerformanceController(usecase as any, owners as any);

    await expect(controller.get(principal, { from: '2026-07-01', to: '2026-07-31' }))
      .resolves.toEqual({ data: report, meta: null, error: null });
    expect(usecase.execute).toHaveBeenCalledWith({
      from: '2026-07-01',
      to: '2026-07-31',
      organizationId: 'org_1'
    });
    expect(Reflect.getMetadata(PATH_METADATA, SalesPerformanceController)).toBe('reports/sales-performance');
    expect(Reflect.getMetadata(PATH_METADATA, SalesPerformanceController.prototype.get)).toBe('/');
  });

  it('lists every owner represented in sales performance data', async () => {
    const get = { execute: jest.fn() };
    const ownerItems = [{ id: 'user_1', name: '過去担当者', email: 'former@example.com', isActive: false }];
    const owners = { execute: jest.fn().mockResolvedValue(ownerItems) };
    const controller = new SalesPerformanceController(get as any, owners as any);

    await expect(controller.owners(principal)).resolves.toEqual({ data: ownerItems, meta: null, error: null });
    expect(owners.execute).toHaveBeenCalledWith('org_1');
    expect(Reflect.getMetadata(PATH_METADATA, SalesPerformanceController.prototype.owners)).toBe('owners');
  });
});
