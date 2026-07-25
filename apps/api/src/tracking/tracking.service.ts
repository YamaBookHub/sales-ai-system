import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditActor } from '../audit/audit-actor';
import {
  COMPANY_MATERIAL_LINK_LABEL,
  materialEngagementForClickCount
} from './domain/material-engagement-policy';
import { CreateTrackedLinkDto, UnsubscribeDto } from './tracking.dto';

export type TrackingRequestMetadata = {
  ip?: string;
  userAgent?: string;
  referer?: string;
};

const OPEN_DEDUPLICATION_MS = 24 * 60 * 60 * 1000;
const CLICK_DEDUPLICATION_MS = 30 * 60 * 1000;

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
        clicks: { where: { isBot: false }, orderBy: { clickedAt: 'desc' } }
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

  async trackOpen(token: string, metadata: TrackingRequestMetadata = {}) {
    if (looksAutomated(metadata.userAgent)) return;
    const email = await this.prisma.outreachEmail.findFirst({
      where: {
        OR: [
          { openTrackingToken: token },
          // Existing links created before opaque tracking tokens were added remain valid.
          { id: token }
        ]
      },
      select: { id: true, organizationId: true }
    });
    if (!email) return;

    const fingerprintHash = trackingFingerprint(metadata);
    const duplicate = await this.prisma.emailEvent.findFirst({
      where: {
        organizationId: email.organizationId,
        emailId: email.id,
        type: 'opened',
        ipHash: fingerprintHash,
        createdAt: { gte: new Date(Date.now() - OPEN_DEDUPLICATION_MS) }
      },
      select: { id: true }
    });
    if (duplicate) return;

    await this.prisma.emailEvent.create({
      data: {
        organizationId: email.organizationId,
        emailId: email.id,
        type: 'opened',
        ipHash: fingerprintHash,
        userAgent: 'browser'
      }
    });
  }

  async resolveClick(token: string, metadata: TrackingRequestMetadata = {}) {
    const link = await this.prisma.trackedLink.findUnique({
      where: { token },
      include: { email: { select: { id: true, leadId: true } } }
    });

    if (!link) {
      throw new NotFoundException('Tracking link not found');
    }

    if (looksAutomated(metadata.userAgent)) return link.originalUrl;
    const fingerprintHash = trackingFingerprint(metadata);
    const duplicate = await this.prisma.linkClick.findFirst({
      where: {
        organizationId: link.organizationId,
        linkId: link.id,
        fingerprintHash,
        isBot: false,
        clickedAt: { gte: new Date(Date.now() - CLICK_DEDUPLICATION_MS) }
      },
      select: { id: true }
    });
    if (duplicate) return link.originalUrl;

    await this.prisma.linkClick.create({
      data: {
        organizationId: link.organizationId,
        linkId: link.id,
        fingerprintHash,
        isBot: false,
        userAgent: 'browser',
        referer: safeRefererOrigin(metadata.referer)
      }
    });
    const clickCount = await this.prisma.linkClick.count({
      where: { organizationId: link.organizationId, linkId: link.id, isBot: false }
    });
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
    return link.originalUrl;
  }

  async assertUnsubscribeToken(token: string) {
    const email = await this.prisma.outreachEmail.findUnique({
      where: { unsubscribeToken: token },
      select: { id: true }
    });
    if (!email) throw new NotFoundException('配信停止リンクが無効です。');
  }

  async unsubscribeByToken(token: string) {
    return this.prisma.$transaction(async (tx) => {
      const email = await tx.outreachEmail.findUnique({
        where: { unsubscribeToken: token },
        select: {
          id: true,
          organizationId: true,
          contactId: true,
          toEmail: true
        }
      });
      if (!email) throw new NotFoundException('配信停止リンクが無効です。');

      const now = new Date();
      const result = email.contactId
        ? await tx.contactPerson.updateMany({
            where: {
              organizationId: email.organizationId,
              id: email.contactId,
              deletedAt: null
            },
            data: { isUnsubscribed: true, unsubscribedAt: now, isPrimary: false }
          })
        : email.toEmail
          ? await tx.contactPerson.updateMany({
              where: {
                organizationId: email.organizationId,
                email: { equals: email.toEmail, mode: 'insensitive' },
                deletedAt: null
              },
              data: { isUnsubscribed: true, unsubscribedAt: now, isPrimary: false }
            })
          : { count: 0 };

      const alreadyRecorded = await tx.emailEvent.findFirst({
        where: {
          organizationId: email.organizationId,
          emailId: email.id,
          type: 'unsubscribed'
        },
        select: { id: true }
      });
      if (!alreadyRecorded) {
        await tx.emailEvent.create({
          data: {
            organizationId: email.organizationId,
            emailId: email.id,
            type: 'unsubscribed',
            payload: {
              source: 'recipient_link',
              updatedCount: result.count
            }
          }
        });
      }

      return { isUnsubscribed: true };
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

function trackingFingerprint(metadata: TrackingRequestMetadata) {
  const secret = process.env.TRACKING_HASH_SECRET || process.env.CSRF_SECRET || 'local-tracking-hash-secret';
  const source = `${metadata.ip || 'unknown'}\n${normalizeUserAgent(metadata.userAgent)}`;
  return createHmac('sha256', secret).update(source).digest('hex');
}

function normalizeUserAgent(value?: string) {
  return String(value || '').trim().toLowerCase().slice(0, 256);
}

function looksAutomated(userAgent?: string) {
  const normalized = normalizeUserAgent(userAgent);
  if (!normalized) return true;
  return /(bot|crawler|spider|scanner|proofpoint|mimecast|barracuda|safelinks|safe links|googleimageproxy|curl|wget|headless|preview)/i.test(
    normalized
  );
}

function safeRefererOrigin(value?: string) {
  if (!value) return null;
  try {
    return new URL(value).origin.slice(0, 512);
  } catch {
    return null;
  }
}
