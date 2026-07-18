import { Injectable } from '@nestjs/common';
import { PrismaOpportunityRepository } from '../infrastructure/prisma-opportunity.repository';
import {
  ListOpportunitiesQueryDto,
  ReopenOpportunityDto,
  TransitionOpportunityDto,
  UpdateOpportunityDto
} from '../opportunities.dto';

const LOCAL_MANAGER = { userId: null, role: 'manager' as const };

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
  execute(leadId: string, input: UpdateOpportunityDto) {
    return this.opportunities.updateDetails(leadId, input, LOCAL_MANAGER);
  }
}

@Injectable()
export class TransitionOpportunityUseCase {
  constructor(private readonly opportunities: PrismaOpportunityRepository) {}
  execute(leadId: string, input: TransitionOpportunityDto) {
    return this.opportunities.transition(leadId, input, LOCAL_MANAGER);
  }
}

@Injectable()
export class ReopenOpportunityUseCase {
  constructor(private readonly opportunities: PrismaOpportunityRepository) {}
  execute(leadId: string, input: ReopenOpportunityDto) {
    return this.opportunities.reopen(leadId, input, LOCAL_MANAGER);
  }
}

@Injectable()
export class ListOpportunityHistoryUseCase {
  constructor(private readonly opportunities: PrismaOpportunityRepository) {}
  execute(leadId: string, page = 1, limit = 20) {
    return this.opportunities.listHistory(leadId, page, limit);
  }
}
