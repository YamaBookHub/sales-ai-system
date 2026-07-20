import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../common/api-response';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedPrincipal } from '../auth/auth.types';
import {
  GetOpportunityUseCase,
  ListOpportunitiesUseCase,
  ListOpportunityHistoryUseCase,
  ReopenOpportunityUseCase,
  TransitionOpportunityUseCase,
  UpdateOpportunityUseCase
} from './application/opportunity.usecases';
import {
  ListOpportunitiesQueryDto,
  ListOpportunityHistoryQueryDto,
  ReopenOpportunityDto,
  TransitionOpportunityDto,
  UpdateOpportunityDto
} from './opportunities.dto';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { AuditAction } from '../audit/audit-action.decorator';

@Controller()
@RequirePermissions('workspace.read')
export class OpportunitiesController {
  constructor(
    private readonly listOpportunities: ListOpportunitiesUseCase,
    private readonly getOpportunity: GetOpportunityUseCase,
    private readonly updateOpportunity: UpdateOpportunityUseCase,
    private readonly transitionOpportunity: TransitionOpportunityUseCase,
    private readonly reopenOpportunity: ReopenOpportunityUseCase,
    private readonly listHistory: ListOpportunityHistoryUseCase
  ) {}

  @Get('opportunities')
  async list(@Query() query: ListOpportunitiesQueryDto) {
    return ok(await this.listOpportunities.execute(query));
  }

  @Get('leads/:leadId/opportunity')
  async get(@Param('leadId', new ParseUUIDPipe()) leadId: string) {
    return ok(await this.getOpportunity.execute(leadId));
  }

  @Patch('leads/:leadId/opportunity')
  @RequirePermissions('opportunity.write')
  async update(
    @Param('leadId', new ParseUUIDPipe()) leadId: string,
    @Body() dto: UpdateOpportunityDto,
    @CurrentUser() principal: AuthenticatedPrincipal
  ) {
    return ok(await this.updateOpportunity.execute(leadId, dto, principal));
  }

  @Post('leads/:leadId/opportunity/transitions')
  @RequirePermissions('opportunity.write')
  @AuditAction('opportunity.transitioned', 'Opportunity', [])
  async transition(
    @Param('leadId', new ParseUUIDPipe()) leadId: string,
    @Body() dto: TransitionOpportunityDto,
    @CurrentUser() principal: AuthenticatedPrincipal
  ) {
    return ok(await this.transitionOpportunity.execute(leadId, dto, principal));
  }

  @Post('leads/:leadId/opportunity/reopen')
  @RequirePermissions('opportunity.reopen')
  @AuditAction('opportunity.reopened', 'Opportunity', [])
  async reopen(
    @Param('leadId', new ParseUUIDPipe()) leadId: string,
    @Body() dto: ReopenOpportunityDto,
    @CurrentUser() principal: AuthenticatedPrincipal
  ) {
    return ok(await this.reopenOpportunity.execute(leadId, dto, principal));
  }

  @Get('leads/:leadId/opportunity/history')
  async history(
    @Param('leadId', new ParseUUIDPipe()) leadId: string,
    @Query() query: ListOpportunityHistoryQueryDto
  ) {
    return ok(await this.listHistory.execute(leadId, query.page, query.limit));
  }
}
