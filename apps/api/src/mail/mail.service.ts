import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailEventType, EmailStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMailDraftDto, UpdateMailDto } from './mail.dto';

@Injectable()
export class MailService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 20, status?: EmailStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.outreachEmail.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.outreachEmail.count({ where })
    ]);

    return { items, page, limit, total };
  }

  async createDraft(dto: CreateMailDraftDto) {
    const lead = await this.prisma.salesLead.findUnique({
      where: { id: dto.leadId },
      include: { company: true }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const email = await this.prisma.outreachEmail.create({
      data: {
        leadId: lead.id,
        companyId: lead.companyId,
        templateKey: dto.templateKey,
        subject: 'クラウドファンディング支援に関する情報交換のお願い',
        body: dto.manualInstruction ?? 'TODO: AI-generated draft body will be inserted here.',
        status: 'draft',
        events: { create: { type: 'created' } }
      }
    });

    return email;
  }

  update(id: string, dto: UpdateMailDto) {
    return this.prisma.outreachEmail.update({ where: { id }, data: dto });
  }

  requestReview(id: string) {
    return this.transition(id, 'in_review', 'reviewed');
  }

  approve(id: string) {
    return this.transition(id, 'approved', 'approved', { approvedAt: new Date() });
  }

  async queue(id: string) {
    const email = await this.get(id);

    if (email.status !== 'approved') {
      throw new ConflictException('Only approved mail can be queued.');
    }

    return this.transition(id, 'queued', 'queued');
  }

  async retry(id: string) {
    const email = await this.get(id);

    if (email.status !== 'failed') {
      throw new ConflictException('Only failed mail can be retried.');
    }

    return this.prisma.outreachEmail.update({
      where: { id },
      data: {
        status: 'queued',
        retryCount: { increment: 1 },
        events: { create: { type: 'retried' } }
      }
    });
  }

  cancel(id: string) {
    return this.transition(id, 'cancelled', 'cancelled');
  }

  async getThread(gmailThreadId: string) {
    const emails = await this.prisma.outreachEmail.findMany({ where: { gmailThreadId } });
    const replies = await this.prisma.emailReply.findMany({ where: { email: { gmailThreadId } } });
    return { gmailThreadId, emails, replies };
  }

  private async get(id: string) {
    const email = await this.prisma.outreachEmail.findUnique({ where: { id } });

    if (!email) {
      throw new NotFoundException('Mail not found');
    }

    return email;
  }

  private transition(id: string, status: EmailStatus, eventType: EmailEventType, extra: Record<string, unknown> = {}) {
    return this.prisma.outreachEmail.update({
      where: { id },
      data: {
        status,
        ...extra,
        events: { create: { type: eventType } }
      }
    });
  }
}
