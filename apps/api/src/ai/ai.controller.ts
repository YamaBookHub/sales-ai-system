import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ok } from '../common/api-response';
import { GenerateMailDto, SelectAiModelDto, UpdateLeadAnalysisDto } from './ai.dto';
import { AiService } from './ai.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { RequirePermissions } from '../auth/require-permissions.decorator';

@Controller('ai')
@RequirePermissions('workspace.read')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('leads/:leadId/generate-mail')
  @RequirePermissions('analysis.execute')
  async generateMailDraft(@Param('leadId') leadId: string, @Body() dto: GenerateMailDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.ai.generateMailDraft(leadId, dto, principal.userId));
  }

  @Post('leads/:leadId/email-draft')
  @RequirePermissions('analysis.execute')
  async generateMailDraftAlias(@Param('leadId') leadId: string, @Body() dto: GenerateMailDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.ai.generateMailDraft(leadId, dto, principal.userId));
  }

  @Post('leads/:leadId/analyze')
  @RequirePermissions('analysis.execute')
  async analyzeLead(@Param('leadId') leadId: string, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.ai.analyzeLead(leadId, principal.userId));
  }

  @Get('leads/:leadId/analysis')
  async getLeadAnalysis(@Param('leadId') leadId: string) {
    return ok(await this.ai.getLeadAnalysis(leadId));
  }

  @Patch('leads/:leadId/analysis')
  @RequirePermissions('analysis.execute')
  async saveLeadAnalysis(@Param('leadId') leadId: string, @Body() dto: UpdateLeadAnalysisDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.ai.saveLeadAnalysis(leadId, dto, principal.userId));
  }

  @Post('leads/:leadId/analysis/confirm')
  @RequirePermissions('analysis.execute')
  async confirmLeadAnalysis(@Param('leadId') leadId: string, @Body() dto: UpdateLeadAnalysisDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.ai.confirmLeadAnalysis(leadId, dto, principal.userId));
  }

  @Post('mails/:mailId/polish')
  @RequirePermissions('analysis.execute')
  async polishMail(@Param('mailId') mailId: string, @Body() dto: SelectAiModelDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.ai.polishMail(mailId, dto?.model, principal.userId));
  }

  @Post('mails/:mailId/semantic-consistency')
  @RequirePermissions('analysis.execute')
  async checkMailSemanticConsistency(@Param('mailId') mailId: string, @Body() dto: SelectAiModelDto) {
    return ok(await this.ai.checkMailSemanticConsistency(mailId, dto?.model));
  }

  @Get('leads/:leadId/generations')
  async listLeadGenerations(@Param('leadId') leadId: string) {
    return ok(await this.ai.listLeadGenerations(leadId));
  }

  @Get('usage-summary')
  @RequirePermissions('ai.cost.read')
  async getUsageSummary() {
    return ok(await this.ai.getOpenAiUsageSummary());
  }

  @Post('replies/:replyId/classify')
  @RequirePermissions('analysis.execute')
  async classifyReply(@Param('replyId') replyId: string, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.ai.classifyReply(replyId, principal.userId));
  }
}
