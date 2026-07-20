import { Injectable } from '@nestjs/common';
import { OpportunityActor, PrismaOpportunityRepository } from '../infrastructure/prisma-opportunity.repository';
import {
  ListOpportunitiesQueryDto,
  ReopenOpportunityDto,
  TransitionOpportunityDto,
  UpdateOpportunityDto
} from '../opportunities.dto';

@Injectable()
export class ListOpportunitiesUseCase {
  constructor(private readonly opportunities: PrismaOpportunityRepository) {}
  execute(query: ListOpportunitiesQueryDto) {
    return this.opportunities.list(query);
  }
}

@Injectable()
export class GetOpportunityUseCase {
  constructor(private readonly opportunities: PrismaOpportunityRepository) {}
  execute(leadId: string) {
    return this.opportunities.getByLeadId(leadId);
  }
}

@Injectable()
export class UpdateOpportunityUseCase {
  constructor(private readonly opportunities: PrismaOpportunityRepository) {}
  execute(leadId: string, input: UpdateOpportunityDto, actor: OpportunityActor) {
    return this.opportunities.updateDetails(leadId, input, actor);
  }
}

@Injectable()
export class TransitionOpportunityUseCase {
  constructor(private readonly opportunities: PrismaOpportunityRepository) {}
  execute(leadId: string, input: TransitionOpportunityDto, actor: OpportunityActor) {
    return this.opportunities.transition(leadId, input, actor);
  }
}

@Injectable()
export class ReopenOpportunityUseCase {
  constructor(private readonly opportunities: PrismaOpportunityRepository) {}
  execute(leadId: string, input: ReopenOpportunityDto, actor: OpportunityActor) {
    return this.opportunities.reopen(leadId, input, actor);
  }
}

@Injectable()
export class ListOpportunityHistoryUseCase {
  constructor(private readonly opportunities: PrismaOpportunityRepository) {}
  execute(leadId: string, page = 1, limit = 20) {
    return this.opportunities.listHistory(leadId, page, limit);
  }
}
