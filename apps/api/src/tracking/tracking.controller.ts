import { Body, Controller, Get, Header, Param, Post, Redirect } from '@nestjs/common';
import { ok } from '../common/api-response';
import { TrackingService } from './tracking.service';
import { CreateTrackedLinkDto, UnsubscribeDto } from './tracking.dto';

const GIF_1X1 = Buffer.from('R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

@Controller()
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Get('t/open/:emailId.png')
  @Header('Content-Type', 'image/gif')
  async trackOpen(@Param('emailId') emailId: string) {
    await this.tracking.trackOpen(emailId);
    return GIF_1X1;
  }

  @Post('t/links')
  async createTrackedLink(@Body() dto: CreateTrackedLinkDto) {
    return ok(await this.tracking.createTrackedLink(dto));
  }

  @Get('t/mails/:emailId/engagement')
  async getMailEngagement(@Param('emailId') emailId: string) {
    return ok(await this.tracking.getMailEngagement(emailId));
  }

  @Get('t/click/:token')
  @Redirect()
  async trackClick(@Param('token') token: string) {
    return { url: await this.tracking.resolveClick(token), statusCode: 302 };
  }

  @Post('unsubscribe')
  async unsubscribe(@Body() dto: UnsubscribeDto) {
    return ok(await this.tracking.unsubscribe(dto));
  }
}
