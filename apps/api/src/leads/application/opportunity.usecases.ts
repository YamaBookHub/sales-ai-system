import { Injectable } from '@nestjs/common';
import { PrismaOpportunityRepository } from '../infrastructure/prisma-opportunity.repository';
import {
  ListOpportunitiesQueryDto,
  ReopenOpportunityDto,
  TransitionOpportunityDto,
  UpdateOpportunityDto
} from '../opportunities.dto';
import { AuthenticatedPrincipal } from '../../auth/auth.types';

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
  execute(leadId: string, input: UpdateOpportunityDto, principal: AuthenticatedPrincipal) {
    return this.opportunities.updateDetails(leadId, input, principal);
  }
}

@Injectable()
export class TransitionOpportunityUseCase {
  constructor(private readonly opportunities: PrismaOpportunityRepository) {}
  execute(leadId: string, input: TransitionOpportunityDto, principal: AuthenticatedPrincipal) {
    return this.opportunities.transition(leadId, input, principal);
  }
}

@Injectable()
export class ReopenOpportunityUseCase {
  constructor(private readonly opportunities: PrismaOpportunityRepository) {}
  execute(leadId: string, input: ReopenOpportunityDto, principal: AuthenticatedPrincipal) {
    return this.opportunities.reopen(leadId, input, principal);
  }
}

@Injectable()
export class ListOpportunityHistoryUseCase {
  constructor(private readonly opportunities: PrismaOpportunityRepository) {}
  execute(leadId: string, page = 1, limit = 20) {
    return this.opportunities.listHistory(leadId, page, limit);
  }
}
