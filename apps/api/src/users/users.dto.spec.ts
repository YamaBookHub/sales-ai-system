import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListUsersQueryDto } from './users.dto';

describe('ListUsersQueryDto', () => {
  it('transforms supported query values', async () => {
    const dto = plainToInstance(ListUsersQueryDto, { page: '2', limit: '50', role: 'manager', isActive: 'false' });
    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto).toMatchObject({ page: 2, limit: 50, role: 'manager', isActive: false });
  });

  it('rejects invalid roles and boolean filters', async () => {
    const dto = plainToInstance(ListUsersQueryDto, { role: 'owner', isActive: 'no' });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property).sort()).toEqual(['isActive', 'role']);
  });
});
