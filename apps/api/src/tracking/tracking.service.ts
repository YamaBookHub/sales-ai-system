import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  COMPANY_MATERIAL_LINK_LABEL,
  materialEngagementForClickCount,
  nextActionAtForMaterialEngagement
} from './domain/material-engagement-policy';
import { CreateTrackedLinkDto, UnsubscribeDto } from './tracking.dto';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async createTrackedLink(dto: CreateTrackedLinkDto) {
    const email = await this.prisma.outreachEmail.findUnique({ where: { id: dto.emailId } });
    if (!email) {
      throw new NotFoundException('Mail not found');
    }

    const label = dto.label || COMPANY_MATERIAL_LINK_LABEL;
    const existing = await this.prisma.trackedLink.findFirst({
      where: { emailId: dto.emailId, originalUrl: dto.originalUrl, label }
    });
    if (existing) {
      return {
        ...existing,
        trackingPath: `/t/click/${existing.token}`
      };
    }

    const link = await this.prisma.trackedLink.create({
      data: {
        emailId: dto.emailId,
        token: createTrackingToken(),
        originalUrl: dto.originalUrl,
        label
      }
    });

    return {
      ...link,
      trackingPath: `/t/click/${link.token}`
    };
  }

  async getMailEngagement(emailId: string) {
    const links = await this.prisma.trackedLink.findMany({
      where: { emailId },
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
    await this.prisma.emailEvent.create({ data: { emailId, type: 'opened' } });
  }

  async resolveClick(token: string) {
    const link = await this.prisma.trackedLink.findUnique({
      where: { token },
      include: { email: { select: { id: true, leadId: true } } }
    });

    if (!link) {
      throw new NotFoundException('Tracking link not found');
    }

    await this.prisma.linkClick.create({ data: { linkId: link.id } });
    const clickCount = await this.prisma.linkClick.count({ where: { linkId: link.id } });
    await this.prisma.emailEvent.create({
      data: {
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
      await this.applyMaterialEngagement(link.email.leadId, clickCount);
    }
    return link.originalUrl;
  }

  private async applyMaterialEngagement(leadId: string, clickCount: number) {
    const engagement = materialEngagementForClickCount(clickCount);
    if (engagement.label === 'none') return;

    const lead = await this.prisma.salesLead.findUnique({ where: { id: leadId }, select: { score: true } });
    if (!lead) return;

    await this.prisma.salesLead.update({
      where: { id: leadId },
      data: {
        score: Math.max(lead.score || 0, engagement.scoreFloor),
        priority: engagement.priority,
        status: engagement.leadStatus,
        nextActionAt: nextActionAtForMaterialEngagement(new Date(), engagement.nextActionInDays || 1)
      }
    });
  }

  async unsubscribe(dto: UnsubscribeDto) {
    if (dto.contactId) {
      const contact = await this.prisma.contactPerson.update({
        where: { id: dto.contactId },
        data: { isUnsubscribed: true, unsubscribedAt: new Date() }
      });
      return { contactId: contact.id, isUnsubscribed: true };
    }

    if (dto.email) {
      await this.prisma.contactPerson.updateMany({
        where: { email: dto.email },
        data: { isUnsubscribed: true, unsubscribedAt: new Date() }
      });
      return { email: dto.email, isUnsubscribed: true };
    }

    return { isUnsubscribed: false, message: 'email or contactId is required' };
  }
}

function createTrackingToken() {
  return randomBytes(18).toString('base64url');
}
