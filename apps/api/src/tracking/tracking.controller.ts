import { Body, Controller, Get, Header, HttpCode, Param, Post, Redirect, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Header('Content-Type', 'image/gif')
  async trackOpen(@Param('emailId') emailId: string, @Req() request: TrackingRequest) {
    await this.tracking.trackOpen(emailId, requestMetadata(request));
    return GIF_1X1;
  }

  @Post('t/links')
  @RequirePermissions('records.write')
  async createTrackedLink(@Body() dto: CreateTrackedLinkDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.tracking.createTrackedLink(dto, auditActor(principal)));
  }

  @Get('t/mails/:emailId/engagement')
  async getMailEngagement(@Param('emailId') emailId: string, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.tracking.getMailEngagement(principal.organizationId, emailId));
  }

  @Get('t/click/:token')
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Redirect()
  async trackClick(@Param('token') token: string, @Req() request: TrackingRequest) {
    return { url: await this.tracking.resolveClick(token, requestMetadata(request)), statusCode: 302 };
  }

  @Get('unsubscribe/:token')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Content-Type', 'text/html; charset=utf-8')
  async publicUnsubscribePage(@Param('token') token: string) {
    await this.tracking.assertUnsubscribeToken(token);
    return renderUnsubscribePage(token, false);
  }

  @Post('unsubscribe/:token')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Content-Type', 'text/html; charset=utf-8')
  async publicUnsubscribe(@Param('token') token: string) {
    await this.tracking.unsubscribeByToken(token);
    return renderUnsubscribePage(token, true);
  }

  @Post('unsubscribe')
  @RequirePermissions('compliance.manage')
  async unsubscribe(@Body() dto: UnsubscribeDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.tracking.unsubscribe(dto, auditActor(principal)));
  }
}

type TrackingRequest = {
  ip?: string;
  socket?: { remoteAddress?: string };
  headers: Record<string, string | string[] | undefined>;
};

function requestMetadata(request: TrackingRequest) {
  return {
    ip: request.ip || request.socket?.remoteAddress,
    userAgent: firstHeader(request.headers['user-agent']),
    referer: firstHeader(request.headers.referer)
  };
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function renderUnsubscribePage(token: string, completed: boolean) {
  const message = completed
    ? '配信停止を受け付けました。今後、この宛先への営業メールは送信されません。'
    : 'この宛先への営業メール配信を停止します。';
  const action = completed
    ? ''
    : `<form method="post" action="/unsubscribe/${encodeURIComponent(token)}"><button type="submit">配信を停止する</button></form>`;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>メール配信停止</title><style>body{font-family:system-ui,sans-serif;max-width:640px;margin:72px auto;padding:0 24px;color:#172033}main{border:1px solid #d8deea;border-radius:16px;padding:32px;box-shadow:0 12px 30px rgba(23,32,51,.08)}button{border:0;border-radius:10px;padding:12px 20px;background:#1f5eff;color:white;font-weight:700;cursor:pointer}p{line-height:1.8}</style></head><body><main><h1>メール配信停止</h1><p>${message}</p>${action}</main></body></html>`;
}
