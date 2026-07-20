import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ok } from '../common/api-response';
import { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('admin/users')
@RequirePermissions('user.manage')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(@Query() query: ListUsersQueryDto, @CurrentUser() actor: AuthenticatedPrincipal) {
    return ok(await this.users.list(query.page, query.limit, query.role, query.isActive, actor));
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthenticatedPrincipal) {
    return ok(await this.users.create(dto, actor));
  }

  @Patch(':id')
  async update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthenticatedPrincipal) {
    return ok(await this.users.update(id, dto, actor));
  }

  @Post(':id/revoke-sessions')
  async revokeSessions(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() actor: AuthenticatedPrincipal) {
    return ok(await this.users.revokeSessions(id, actor));
  }
}
