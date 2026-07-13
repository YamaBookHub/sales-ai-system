import { Controller, Get } from '@nestjs/common';
import { ok } from '../common/api-response';
import { NavigationSummaryService } from './navigation-summary.service';

@Controller()
export class NavigationSummaryController {
  constructor(private readonly navigationSummary: NavigationSummaryService) {}

  @Get('navigation-summary')
  async getSummary() {
    return ok(await this.navigationSummary.getSummary());
  }
}
