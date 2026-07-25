import { HealthService, LATEST_REQUIRED_MIGRATION } from './health.service';

describe('HealthService', () => {
  it('is ready only when the database and latest migration are available', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ migration_name: LATEST_REQUIRED_MIGRATION }])
    };

    await expect(new HealthService(prisma as any).readiness()).resolves.toEqual({
      ready: true,
      migration: LATEST_REQUIRED_MIGRATION
    });
  });

  it('is not ready when migrations are missing or the database cannot be reached', async () => {
    const missing = { $queryRaw: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]) };
    await expect(new HealthService(missing as any).readiness()).resolves.toEqual({ ready: false });

    const unavailable = { $queryRaw: jest.fn().mockRejectedValue(new Error('offline')) };
    await expect(new HealthService(unavailable as any).readiness()).resolves.toEqual({ ready: false });
  });
});
