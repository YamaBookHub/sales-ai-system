import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListAuditLogsQueryDto } from './audit-query.dto';

describe('ListAuditLogsQueryDto', () => {
  it('transforms valid pagination and accepts ISO date filters', async () => {
    const dto = plainToInstance(ListAuditLogsQueryDto, {
      page: '2',
      limit: '100',
      userId: '00000000-0000-4000-8000-000000000001',
      from: '2026-07-20T00:00:00.000Z'
    });
    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(100);
  });

  it('rejects malformed UUID, date, and oversized pagination', async () => {
    const dto = plainToInstance(ListAuditLogsQueryDto, { userId: 'no', from: 'today', limit: '101' });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property).sort()).toEqual(['from', 'limit', 'userId']);
  });
});
