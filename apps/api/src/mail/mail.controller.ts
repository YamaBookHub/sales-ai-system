import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { EmailStatus } from '@prisma/client';
import { ok } from '../common/api-response';
import {
  CreateMailDraftDto,
  CreateMailReplyDto,
  ImportMailTemplatesDto,
  MarkMailSentDto,
  RejectMailDto,
  SaveMailTemplateDto,
  UpdateMailChecklistDto,
  UpdateMailDto
} from './mail.dto';
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

  @Get('templates')
  async listTemplates(@Query('channel') channel?: string) {
    return ok(await this.mail.listTemplates(channel));
  }

  @Get('templates/:key')
  async getTemplate(@Param('key') key: string) {
    return ok(await this.mail.getTemplate(key));
  }

  @Post('templates')
  async saveTemplate(@Body() dto: SaveMailTemplateDto) {
    return ok(await this.mail.saveTemplate(dto));
  }

  @Post('templates/import')
  async importTemplates(@Body() dto: ImportMailTemplatesDto) {
    return ok(await this.mail.importTemplates(dto));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateMailDto) {
    return ok(await this.mail.update(id, dto));
  }

  @Get(':id/checklist')
  async getChecklist(@Param('id') id: string) {
    return ok(await this.mail.getChecklist(id));
  }

  @Patch(':id/checklist')
  async updateChecklist(@Param('id') id: string, @Body() dto: UpdateMailChecklistDto) {
    return ok(await this.mail.updateChecklist(id, dto));
  }

  @Post(':id/request-review')
  async requestReview(@Param('id') id: string) {
    return ok(await this.mail.requestReview(id));
  }

  @Post(':id/request-rereview')
  async requestReReview(@Param('id') id: string) {
    return ok(await this.mail.requestReReview(id));
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string) {
    return ok(await this.mail.approve(id));
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body() dto: RejectMailDto) {
    return ok(await this.mail.reject(id, dto));
  }

  @Post(':id/queue')
  async queue(@Param('id') id: string) {
    return ok(await this.mail.queue(id));
  }

  @Post(':id/mark-sent')
  async markSent(@Param('id') id: string, @Body() dto: MarkMailSentDto) {
    return ok(await this.mail.markSent(id, dto));
  }

  @Post(':id/send')
  async sendQueued(@Param('id') id: string) {
    return ok(await this.mail.sendQueued(id));
  }

  @Post(':id/replies')
  async recordReply(@Param('id') id: string, @Body() dto: CreateMailReplyDto) {
    return ok(await this.mail.recordReply(id, dto));
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
