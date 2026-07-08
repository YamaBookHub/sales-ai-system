import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UnsubscribeDto } from './tracking.dto';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async trackOpen(emailId: string) {
    await this.prisma.emailEvent.create({ data: { emailId, type: 'opened' } });
  }

  async resolveClick(token: string) {
    const link = await this.prisma.trackedLink.findUnique({ where: { token } });

    if (!link) {
      throw new NotFoundException('Tracking link not found');
    }

    await this.prisma.linkClick.create({ data: { linkId: link.id } });
    await this.prisma.emailEvent.create({ data: { emailId: link.emailId, type: 'clicked' } });
    return link.originalUrl;
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
