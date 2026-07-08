import { Body, Controller, Param, Post } from '@nestjs/common';
import { ok } from '../common/api-response';
import { GenerateMailDto } from './ai.dto';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('leads/:leadId/generate-mail')
  async generateMailDraft(@Param('leadId') leadId: string, @Body() dto: GenerateMailDto) {
    return ok(await this.ai.generateMailDraft(leadId, dto));
  }

  @Post('leads/:leadId/email-draft')
  async generateMailDraftAlias(@Param('leadId') leadId: string, @Body() dto: GenerateMailDto) {
    return ok(await this.ai.generateMailDraft(leadId, dto));
  }

  @Post('replies/:replyId/classify')
  async classifyReply(@Param('replyId') replyId: string) {
    return ok(await this.ai.classifyReply(replyId));
  }
}
