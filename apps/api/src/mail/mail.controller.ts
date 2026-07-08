import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { EmailStatus } from '@prisma/client';
import { ok } from '../common/api-response';
import { CreateMailDraftDto, UpdateMailDto } from './mail.dto';
import { MailService } from './mail.service';

@Controller('mails')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Get()
  async list(@Query('page') page = '1', @Query('limit') limit = '20', @Query('status') status?: EmailStatus) {
    return ok(await this.mail.list(Number(page), Number(limit), status));
  }

  @Post('draft')
  async createDraft(@Body() dto: CreateMailDraftDto) {
    return ok(await this.mail.createDraft(dto));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateMailDto) {
    return ok(await this.mail.update(id, dto));
  }

  @Post(':id/request-review')
  async requestReview(@Param('id') id: string) {
    return ok(await this.mail.requestReview(id));
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string) {
    return ok(await this.mail.approve(id));
  }

  @Post(':id/queue')
  async queue(@Param('id') id: string) {
    return ok(await this.mail.queue(id));
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    return ok(await this.mail.retry(id));
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string) {
    return ok(await this.mail.cancel(id));
  }

  @Get('threads/:gmailThreadId')
  async getThread(@Param('gmailThreadId') gmailThreadId: string) {
    return ok(await this.mail.getThread(gmailThreadId));
  }
}
