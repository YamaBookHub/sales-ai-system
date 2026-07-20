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
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { auditActor } from '../audit/audit-actor';

@Controller('mails')
@RequirePermissions('workspace.read')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Get()
  async list(@Query('page') page = '1', @Query('limit') limit = '20', @Query('status') status?: EmailStatus) {
    return ok(await this.mail.list(Number(page), Number(limit), status));
  }

  @Post('draft')
  @RequirePermissions('records.write')
  async createDraft(@Body() dto: CreateMailDraftDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.mail.createDraft(dto, auditActor(principal)));
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
  @RequirePermissions('template.manage')
  async saveTemplate(@Body() dto: SaveMailTemplateDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.mail.saveTemplate(dto, auditActor(principal)));
  }

  @Post('templates/import')
  @RequirePermissions('template.manage')
  async importTemplates(@Body() dto: ImportMailTemplatesDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.mail.importTemplates(dto, auditActor(principal)));
  }

  @Patch(':id')
  @RequirePermissions('records.write')
  async update(@Param('id') id: string, @Body() dto: UpdateMailDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.mail.update(id, dto, auditActor(principal)));
  }

  @Get(':id/consistency')
  async checkConsistency(@Param('id') id: string) {
    return ok(await this.mail.checkDraftConsistency(id));
  }

  @Get(':id/checklist')
  async getChecklist(@Param('id') id: string) {
    return ok(await this.mail.getChecklist(id));
  }

  @Patch(':id/checklist')
  @RequirePermissions('records.write')
  async updateChecklist(@Param('id') id: string, @Body() dto: UpdateMailChecklistDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.mail.updateChecklist(id, dto, auditActor(principal)));
  }

  @Post(':id/request-review')
  @RequirePermissions('records.write')
  async requestReview(@Param('id') id: string, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.mail.requestReview(id, auditActor(principal)));
  }

  @Post(':id/request-rereview')
  @RequirePermissions('records.write')
  async requestReReview(@Param('id') id: string, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.mail.requestReReview(id, auditActor(principal)));
  }

  @Post(':id/approve')
  @RequirePermissions('mail.review')
  async approve(@Param('id') id: string, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.mail.approve(id, auditActor(principal)));
  }

  @Post(':id/reject')
  @RequirePermissions('mail.review')
  async reject(@Param('id') id: string, @Body() dto: RejectMailDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.mail.reject(id, dto, auditActor(principal)));
  }

  @Post(':id/queue')
  @RequirePermissions('mail.queue')
  async queue(@Param('id') id: string, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.mail.queue(id, auditActor(principal)));
  }

  @Post(':id/mark-sent')
  @RequirePermissions('records.write')
  async markSent(@Param('id') id: string, @Body() dto: MarkMailSentDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.mail.markSent(id, dto, auditActor(principal)));
  }

  @Post(':id/send')
  @RequirePermissions('mail.send')
  async sendQueued(@Param('id') id: string, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.mail.sendQueued(id, auditActor(principal)));
  }

  @Post(':id/replies')
  @RequirePermissions('records.write')
  async recordReply(@Param('id') id: string, @Body() dto: CreateMailReplyDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.mail.recordReply(id, dto, auditActor(principal)));
  }

  @Post(':id/retry')
  @RequirePermissions('mail.queue')
  async retry(@Param('id') id: string, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.mail.retry(id, auditActor(principal)));
  }

  @Post(':id/cancel')
  @RequirePermissions('mail.queue')
  async cancel(@Param('id') id: string, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.mail.cancel(id, auditActor(principal)));
  }

  @Get('threads/:gmailThreadId')
  async getThread(@Param('gmailThreadId') gmailThreadId: string) {
    return ok(await this.mail.getThread(gmailThreadId));
  }
}
