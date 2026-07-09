import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailEventType, EmailStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMailDraftDto, RejectMailDto, UpdateMailChecklistDto, UpdateMailDto } from './mail.dto';

const DEFAULT_CHECKLIST_ITEMS = [
  { key: 'company_product_correct', label: '会社名・商品名が正しい' },
  { key: 'no_other_company_left', label: '別会社名や別商品名が残っていない' },
  { key: 'claims_not_overstated', label: '実績表現が言い過ぎではない' },
  { key: 'not_too_pushy', label: '売り込み感が強すぎない' },
  { key: 'cta_info_exchange', label: '15〜20分の情報交換CTAになっている' },
  { key: 'contact_confirmed', label: '送信先・問い合わせ先を確認した' }
];

@Injectable()
export class MailService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 20, status?: EmailStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.outreachEmail.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { company: true, lead: { include: { project: true } } }
      }),
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
        subject: 'CAMPFIREでのプロジェクトを拝見しご連絡いたしました',
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

  async requestReReview(id: string) {
    const email = await this.get(id);
    if (email.status !== 'rejected') {
      throw new ConflictException('Only rejected mail can be requested for re-review.');
    }

    return this.transition(id, 'in_review', 'reviewed', {
      failedReason: null
    }, { reReview: true });
  }

  approve(id: string) {
    return this.approveWithChecklist(id);
  }

  async reject(id: string, dto: RejectMailDto) {
    const email = await this.get(id);
    if (!['draft', 'in_review', 'approved'].includes(email.status)) {
      throw new ConflictException('Only draft, in_review or approved mail can be rejected.');
    }

    const reason = dto.reason?.trim() || 'rejected_by_reviewer';
    return this.transition(id, 'rejected', 'rejected', {
      failedReason: reason,
      approvedAt: null
    }, { reason });
  }

  async queue(id: string) {
    const email = await this.get(id);

    if (email.status !== 'approved') {
      throw new ConflictException('Only approved mail can be queued.');
    }

    await this.assertChecklistComplete(id);
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

  async getChecklist(emailId: string) {
    await this.get(emailId);
    await this.ensureDefaultChecklist(emailId);
    const items = await this.prisma.mailChecklistItem.findMany({
      where: { emailId },
      orderBy: { createdAt: 'asc' }
    });

    return {
      items,
      complete: items.length > 0 && items.every((item) => item.checked)
    };
  }

  async updateChecklist(emailId: string, dto: UpdateMailChecklistDto) {
    await this.get(emailId);
    const now = new Date();
    const items = dto.items.length ? dto.items : DEFAULT_CHECKLIST_ITEMS.map((item) => ({ ...item, checked: false }));

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.mailChecklistItem.upsert({
          where: { emailId_key: { emailId, key: item.key } },
          update: {
            label: item.label,
            checked: item.checked,
            checkedAt: item.checked ? now : null
          },
          create: {
            emailId,
            key: item.key,
            label: item.label,
            checked: item.checked,
            checkedAt: item.checked ? now : null
          }
        });
      }

      await tx.emailEvent.create({
        data: {
          emailId,
          type: 'reviewed',
          payload: {
            checklistUpdated: true,
            complete: items.every((item) => item.checked),
            checkedCount: items.filter((item) => item.checked).length,
            totalCount: items.length
          }
        }
      });
    });

    return this.getChecklist(emailId);
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

  private async approveWithChecklist(id: string) {
    await this.assertChecklistComplete(id);
    return this.transition(id, 'approved', 'approved', { approvedAt: new Date() });
  }

  private async assertChecklistComplete(emailId: string) {
    const checklist = await this.getChecklist(emailId);
    if (!checklist.complete) {
      throw new ConflictException('送信前チェックリストが未完了です。全項目を確認してから承認してください。');
    }
  }

  private async ensureDefaultChecklist(emailId: string) {
    const count = await this.prisma.mailChecklistItem.count({ where: { emailId } });
    if (count > 0) return;

    await this.prisma.mailChecklistItem.createMany({
      data: DEFAULT_CHECKLIST_ITEMS.map((item) => ({
        emailId,
        key: item.key,
        label: item.label,
        checked: false
      })),
      skipDuplicates: true
    });
  }

  private transition(
    id: string,
    status: EmailStatus,
    eventType: EmailEventType,
    extra: Record<string, unknown> = {},
    payload?: Prisma.InputJsonObject
  ) {
    return this.prisma.outreachEmail.update({
      where: { id },
      data: {
        status,
        ...extra,
        events: { create: { type: eventType, payload } }
      }
    });
  }
}
