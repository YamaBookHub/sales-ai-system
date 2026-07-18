import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ok } from '../common/api-response';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './contacts.dto';

@Controller()
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get('companies/:companyId/contacts')
  async listByCompany(@Param('companyId') companyId: string) {
    return ok(await this.contacts.listByCompany(companyId));
  }

  @Post('companies/:companyId/contacts')
  async create(@Param('companyId') companyId: string, @Body() dto: CreateContactDto) {
    return ok(await this.contacts.create(companyId, dto));
  }

  @Patch('contacts/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return ok(await this.contacts.update(id, dto));
  }

  @Post('contacts/:id/archive')
  async archive(@Param('id') id: string) {
    return ok(await this.contacts.archive(id));
  }

  @Post('contacts/:id/unsubscribe')
  async unsubscribe(@Param('id') id: string) {
    return ok(await this.contacts.unsubscribe(id));
  }
}
