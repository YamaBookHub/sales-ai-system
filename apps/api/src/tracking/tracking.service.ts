import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditActor } from '../audit/audit-actor';
import {
  COMPANY_MATERIAL_LINK_LABEL,
  materialEngagementForClickCount,
  nextActionAtForMaterialEngagement
} from './domain/material-engagement-policy';
import { CreateTrackedLinkDto, UnsubscribeDto } from './tracking.dto';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async createTrackedLink(dto: CreateTrackedLinkDto, actor?: AuditActor) {
    if (!actor) throw new NotFoundException('Organization context not found');
    return this.prisma.$transaction(async (tx) => {
      const email = await tx.outreachEmail.findFirst({ where: { id: dto.emailId, organizationId: actor.organizationId } });
      if (!email) {
        throw new NotFoundException('Mail not found');
      }

      const label = dto.label || COMPANY_MATERIAL_LINK_LABEL;
      const existing = await tx.trackedLink.findFirst({
        where: { organizationId: actor.organizationId, emailId: dto.emailId, originalUrl: dto.originalUrl, label }
      });
      if (existing) {
        return { ...existing, trackingPath: `/t/click/${existing.token}` };
      }

      const link = await tx.trackedLink.create({
        data: {
          organizationId: actor.organizationId,
          emailId: dto.emailId,
          token: createTrackingToken(),
          originalUrl: dto.originalUrl,
          label
        }
      });
      if (actor) {
        await tx.auditLog.create({
          data: {
            ...actor,
            action: 'tracked_link.created',
            entityType: 'TrackedLink',
            entityId: link.id,
            after: { trackedLinkId: link.id, emailId: link.emailId, label: link.label ?? null }
          }
        });
      }
      return { ...link, trackingPath: `/t/click/${link.token}` };
    });
  }

  async getMailEngagement(organizationId: string, emailId: string) {
    const links = await this.prisma.trackedLink.findMany({
      where: { organizationId, emailId },
      include: {
        clicks: { orderBy: { clickedAt: 'desc' } }
      }
    });
    const materialLinks = links.filter((link) => link.label === COMPANY_MATERIAL_LINK_LABEL);
    const materialClickCount = materialLinks.reduce((total, link) => total + link.clicks.length, 0);
    const lastMaterialClickAt = materialLinks.flatMap((link) => link.clicks.map((click) => click.clickedAt))[0] || null;
    const engagement = materialEngagementForClickCount(materialClickCount);

    return {
      emailId,
      materialViewed: materialClickCount > 0,
      materialClickCount,
      lastMaterialClickAt,
      appointmentAngle: engagement.label,
      trackedLinks: links.map((link) => ({
        id: link.id,
        label: link.label,
        originalUrl: link.originalUrl,
        trackingPath: `/t/click/${link.token}`,
        clickCount: link.clicks.length,
        lastClickedAt: link.clicks[0]?.clickedAt || null
      }))
    };
  }

  async trackOpen(emailId: string) {
    const email = await this.prisma.outreachEmail.findUnique({ where: { id: emailId }, select: { organizationId: true } });
    if (!email) return;
    await this.prisma.emailEvent.create({ data: { organizationId: email.organizationId, emailId, type: 'opened' } });
  }

  async resolveClick(token: string) {
    const link = await this.prisma.trackedLink.findUnique({
      where: { token },
      include: { email: { select: { id: true, leadId: true } } }
    });

    if (!link) {
      throw new NotFoundException('Tracking link not found');
    }

    await this.prisma.linkClick.create({ data: { organizationId: link.organizationId, linkId: link.id } });
    const clickCount = await this.prisma.linkClick.count({ where: { organizationId: link.organizationId, linkId: link.id } });
    await this.prisma.emailEvent.create({
      data: {
        organizationId: link.organizationId,
        emailId: link.emailId,
        type: 'clicked',
        payload: {
          label: link.label,
          linkId: link.id,
          clickCount
        }
      }
    });
    if (link.label === COMPANY_MATERIAL_LINK_LABEL && link.email.leadId) {
      await this.applyMaterialEngagement(link.organizationId, link.email.leadId, clickCount);
    }
    return link.originalUrl;
  }

  private async applyMaterialEngagement(organizationId: string, leadId: string, clickCount: number) {
    const engagement = materialEngagementForClickCount(clickCount);
    if (engagement.label === 'none') return;

    const lead = await this.prisma.salesLead.findUnique({
      where: { organizationId_id: { organizationId, id: leadId } },
      select: { score: true }
    });
    if (!lead) return;

    await this.prisma.salesLead.update({
      where: { organizationId_id: { organizationId, id: leadId } },
      data: {
        score: Math.max(lead.score || 0, engagement.scoreFloor),
        priority: engagement.priority,
        status: engagement.leadStatus,
        nextActionAt: nextActionAtForMaterialEngagement(new Date(), engagement.nextActionInDays || 1)
      }
    });
  }

  async unsubscribe(dto: UnsubscribeDto, actor?: AuditActor) {
    if (!actor) throw new NotFoundException('Organization context not found');
    if (dto.contactId) {
      const contactId = dto.contactId;
      return this.prisma.$transaction(async (tx) => {
        const current = await tx.contactPerson.findFirst({
          where: { id: contactId, organizationId: actor.organizationId, deletedAt: null },
          select: { id: true }
        });
        if (!current) throw new NotFoundException('Contact not found');
        const contact = await tx.contactPerson.update({
          where: { organizationId_id: { organizationId: actor.organizationId, id: contactId } },
          data: { isUnsubscribed: true, unsubscribedAt: new Date(), isPrimary: false }
        });
        if (actor) {
          await tx.auditLog.create({
            data: {
              ...actor,
              action: 'contact.unsubscribed',
              entityType: 'ContactPerson',
              entityId: contact.id,
              after: { contactId: contact.id, isUnsubscribed: true, source: 'tracking_api' }
            }
          });
        }
        return { contactId: contact.id, isUnsubscribed: true };
      });
    }

    if (dto.email) {
      const email = dto.email.trim();
      return this.prisma.$transaction(async (tx) => {
        const result = await tx.contactPerson.updateMany({
          where: { organizationId: actor.organizationId, email: { equals: email, mode: 'insensitive' }, deletedAt: null },
          data: { isUnsubscribed: true, unsubscribedAt: new Date(), isPrimary: false }
        });
        if (result.count === 0) {
          return { email, isUnsubscribed: false, message: '一致する有効な連絡先が見つかりません。' };
        }
        if (actor) {
          await tx.auditLog.create({
            data: {
              ...actor,
              action: 'contacts.unsubscribed_by_email',
              entityType: 'ContactPerson',
              after: {
                emailHash: hashForAudit(email),
                updatedCount: result.count,
                isUnsubscribed: true,
                source: 'tracking_api'
              }
            }
          });
        }
        return { email, isUnsubscribed: true, updatedCount: result.count };
      });
    }

    return { isUnsubscribed: false, message: 'email or contactId is required' };
  }
}

function createTrackingToken() {
  return randomBytes(18).toString('base64url');
}

function hashForAudit(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}
