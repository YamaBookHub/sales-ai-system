import { Controller, Get, Query } from '@nestjs/common';
import { ok } from '../common/api-response';
import { ListReplyInboxUseCase } from './application/list-reply-inbox.usecase';
import { ReplyInboxQueryDto } from './reply-inbox.dto';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedPrincipal } from '../auth/auth.types';

// Keep the public API at /api/replies while allowing the protected HTML page
// to use /replies without both routes matching the global-prefix exclusion.
@Controller('api/replies')
@RequirePermissions('workspace.read')
export class ReplyInboxController {
  constructor(private readonly listReplyInbox: ListReplyInboxUseCase) {}

  @Get()
  async list(@Query() query: ReplyInboxQueryDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.listReplyInbox.execute(query, principal.organizationId));
  }
}
