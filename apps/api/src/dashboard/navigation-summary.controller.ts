import { Controller, Get } from '@nestjs/common';
import { ok } from '../common/api-response';
import { NavigationSummaryService } from './navigation-summary.service';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedPrincipal } from '../auth/auth.types';

@Controller()
@RequirePermissions('workspace.read')
export class NavigationSummaryController {
  constructor(private readonly navigationSummary: NavigationSummaryService) {}

  @Get('navigation-summary')
  async getSummary(@CurrentUser() principal: AuthenticatedPrincipal) {
    return ok(await this.navigationSummary.getSummary(principal.organizationId));
  }
}
