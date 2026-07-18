import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ok } from '../common/api-response';
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

@Controller()
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
  async update(
    @Param('leadId', new ParseUUIDPipe()) leadId: string,
    @Body() dto: UpdateOpportunityDto
  ) {
    return ok(await this.updateOpportunity.execute(leadId, dto));
  }

  @Post('leads/:leadId/opportunity/transitions')
  async transition(
    @Param('leadId', new ParseUUIDPipe()) leadId: string,
    @Body() dto: TransitionOpportunityDto
  ) {
    return ok(await this.transitionOpportunity.execute(leadId, dto));
  }

  @Post('leads/:leadId/opportunity/reopen')
  async reopen(
    @Param('leadId', new ParseUUIDPipe()) leadId: string,
    @Body() dto: ReopenOpportunityDto
  ) {
    return ok(await this.reopenOpportunity.execute(leadId, dto));
  }

  @Get('leads/:leadId/opportunity/history')
  async history(
    @Param('leadId', new ParseUUIDPipe()) leadId: string,
    @Query() query: ListOpportunityHistoryQueryDto
  ) {
    return ok(await this.listHistory.execute(leadId, query.page, query.limit));
  }
}
