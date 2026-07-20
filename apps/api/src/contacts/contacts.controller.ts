import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ok } from '../common/api-response';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './contacts.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { auditActor } from '../audit/audit-actor';

@Controller()
@RequirePermissions('workspace.read')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get('companies/:companyId/contacts')
  async listByCompany(@Param('companyId') companyId: string) {
    return ok(await this.contacts.listByCompany(companyId));
  }

  @Post('companies/:companyId/contacts')
  @RequirePermissions('records.write')
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateContactDto,
    @CurrentUser() principal: AuthenticatedPrincipal
  ) {
    return ok(await this.contacts.create(companyId, dto, auditActor(principal)));
  }

  @Patch('contacts/:id')
  @RequirePermissions('records.write')
  async update(@Param('id') id: string, @Body() dto: UpdateContactDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.contacts.update(id, dto, auditActor(principal)));
  }

  @Post('contacts/:id/archive')
  @RequirePermissions('records.write')
  async archive(@Param('id') id: string, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.contacts.archive(id, auditActor(principal)));
  }

  @Post('contacts/:id/unsubscribe')
  @RequirePermissions('compliance.manage')
  async unsubscribe(@Param('id') id: string, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.contacts.unsubscribe(id, auditActor(principal)));
  }
}
