import { Controller, Get, Query } from '@nestjs/common';
import { ok } from '../common/api-response';
import { ListReplyInboxUseCase } from './application/list-reply-inbox.usecase';
import { ReplyInboxQueryDto } from './reply-inbox.dto';

@Controller('replies')
export class ReplyInboxController {
  constructor(private readonly listReplyInbox: ListReplyInboxUseCase) {}

  @Get()
  async list(@Query() query: ReplyInboxQueryDto) {
    return ok(await this.listReplyInbox.execute(query));
  }
}
