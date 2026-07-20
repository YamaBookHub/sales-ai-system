import { Injectable } from '@nestjs/common';
import { PlatformType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SALES_LOSS_REASONS,
  SalesLossReason,
  SalesPerformanceCounts
} from '../domain/sales-performance';
import {
  SalesPerformanceRepository,
  SalesPerformanceRepositoryInput
} from '../domain/sales-performance.repository';

@Injectable()
export class PrismaSalesPerformanceRepository implements SalesPerformanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async summarize(input: SalesPerformanceRepositoryInput): Promise<SalesPerformanceCounts> {
    const leadWhere = buildLeadFilter(input);
    const sentEmails = await this.prisma.outreachEmail.findMany({
      where: {
        organizationId: input.organizationId,
        status: 'sent',
        sentAt: { not: null, gte: input.startUtc, lt: input.endExclusiveUtc },
        events: { some: { type: 'sent' } },
        lead: { is: leadWhere }
      },
      select: {
        id: true,
        sentAt: true,
        leadId: true
      }
    });

    const emailToLead = new Map<string, string>();
    const emailSentAt = new Map<string, Date>();
    const leadFirstSentAt = new Map<string, Date>();
    for (const email of sentEmails) {
      if (!email.leadId || !email.sentAt) continue;
      emailToLead.set(email.id, email.leadId);
      emailSentAt.set(email.id, email.sentAt);
      const previousLeadSentAt = leadFirstSentAt.get(email.leadId);
      if (!previousLeadSentAt || email.sentAt < previousLeadSentAt) {
        leadFirstSentAt.set(email.leadId, email.sentAt);
      }
    }
    const emailIds = [...emailToLead.keys()];
    const leadIds = [...new Set(emailToLead.values())];

    if (leadIds.length === 0) return emptyCounts();

    const [replies, stageHistory, lostOpportunities] = await Promise.all([
      this.prisma.emailReply.findMany({
        where: { organizationId: input.organizationId, emailId: { in: emailIds } },
        select: { emailId: true, receivedAt: true }
      }),
      this.prisma.opportunityStageHistory.findMany({
        where: {
          organizationId: input.organizationId,
          toStage: { in: ['meeting', 'won'] },
          opportunity: { is: { leadId: { in: leadIds } } }
        },
        select: {
          toStage: true,
          createdAt: true,
          opportunity: { select: { leadId: true } }
        }
      }),
      this.prisma.opportunity.findMany({
        where: { organizationId: input.organizationId, leadId: { in: leadIds }, stage: 'lost' },
        select: { leadId: true, lostAt: true, lossReason: true }
      })
    ]);

    const repliedLeadIds = new Set(
      replies
        .filter((reply) => {
          const sentAt = emailSentAt.get(reply.emailId);
          return sentAt ? reply.receivedAt >= sentAt : false;
        })
        .map((reply) => emailToLead.get(reply.emailId))
        .filter((leadId): leadId is string => Boolean(leadId))
    );
    const meetingLeadIds = new Set(
      stageHistory
        .filter((item) => item.toStage === 'meeting' && occurredAfterFirstSend(item.opportunity.leadId, item.createdAt, leadFirstSentAt))
        .map((item) => item.opportunity.leadId)
    );
    const wonLeadIds = new Set(
      stageHistory
        .filter((item) => item.toStage === 'won' && occurredAfterFirstSend(item.opportunity.leadId, item.createdAt, leadFirstSentAt))
        .map((item) => item.opportunity.leadId)
    );
    const lossReasonCounts: Partial<Record<SalesLossReason, number>> = {};
    const cohortLostOpportunities = lostOpportunities.filter((opportunity) =>
      opportunity.lostAt
        ? occurredAfterFirstSend(opportunity.leadId, opportunity.lostAt, leadFirstSentAt)
        : false
    );
    for (const opportunity of cohortLostOpportunities) {
      if (opportunity.lossReason && SALES_LOSS_REASONS.includes(opportunity.lossReason)) {
        lossReasonCounts[opportunity.lossReason] = (lossReasonCounts[opportunity.lossReason] || 0) + 1;
      }
    }

    return {
      sentMessages: emailIds.length,
      contactedLeads: leadIds.length,
      repliedLeads: repliedLeadIds.size,
      meetingLeads: meetingLeadIds.size,
      wonLeads: wonLeadIds.size,
      lostLeads: cohortLostOpportunities.length,
      lossReasonCounts
    };
  }

  async listOwners(organizationId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId,
        ownedOpportunities: {
          some: { lead: { is: { deletedAt: null } } }
        },
        user: { deletedAt: null }
      },
      include: { user: { select: { id: true, name: true, email: true, isActive: true, deletedAt: true } } },
      orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }, { user: { email: 'asc' } }]
    });

    return memberships.map((membership) => ({
      id: membership.user.id,
      name: membership.displayName || membership.user.name,
      email: membership.user.email,
      isActive: membership.isActive && membership.user.isActive && !membership.user.deletedAt
    }));
  }
}

function occurredAfterFirstSend(leadId: string, occurredAt: Date, firstSentAt: Map<string, Date>) {
  const sentAt = firstSentAt.get(leadId);
  return sentAt ? occurredAt >= sentAt : false;
}

function buildLeadFilter(input: SalesPerformanceRepositoryInput): Prisma.SalesLeadWhereInput {
  const where: Prisma.SalesLeadWhereInput = { organizationId: input.organizationId, deletedAt: null };
  if (input.ownerId) where.opportunity = { is: { ownerId: input.ownerId } };
  if (input.source === 'manual') {
    where.projectId = null;
  } else if (input.source) {
    where.project = { is: { platform: { type: input.source as PlatformType } } };
  }
  return where;
}

function emptyCounts(): SalesPerformanceCounts {
  return {
    sentMessages: 0,
    contactedLeads: 0,
    repliedLeads: 0,
    meetingLeads: 0,
    wonLeads: 0,
    lostLeads: 0,
    lossReasonCounts: {}
  };
}
