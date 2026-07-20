import { Body, Controller, Get, Header, Param, Post, Redirect } from '@nestjs/common';
import { ok } from '../common/api-response';
import { TrackingService } from './tracking.service';
import { CreateTrackedLinkDto, UnsubscribeDto } from './tracking.dto';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { auditActor } from '../audit/audit-actor';

const GIF_1X1 = Buffer.from('R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

@Controller()
@RequirePermissions('workspace.read')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Get('t/open/:emailId.png')
  @Public()
  @Header('Content-Type', 'image/gif')
  async trackOpen(@Param('emailId') emailId: string) {
    await this.tracking.trackOpen(emailId);
    return GIF_1X1;
  }

  @Post('t/links')
  @RequirePermissions('records.write')
  async createTrackedLink(@Body() dto: CreateTrackedLinkDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.tracking.createTrackedLink(dto, auditActor(principal)));
  }

  @Get('t/mails/:emailId/engagement')
  async getMailEngagement(@Param('emailId') emailId: string) {
    return ok(await this.tracking.getMailEngagement(emailId));
  }

  @Get('t/click/:token')
  @Public()
  @Redirect()
  async trackClick(@Param('token') token: string) {
    return { url: await this.tracking.resolveClick(token), statusCode: 302 };
  }

  @Post('unsubscribe')
  @RequirePermissions('compliance.manage')
  async unsubscribe(@Body() dto: UnsubscribeDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.tracking.unsubscribe(dto, auditActor(principal)));
  }
}
