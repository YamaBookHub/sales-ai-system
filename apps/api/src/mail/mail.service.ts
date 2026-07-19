import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveMailUseCase } from './application/approve-mail.usecase';
import { CheckMailDraftConsistencyUseCase } from './application/check-mail-draft-consistency.usecase';
import { MarkMailSentUseCase } from './application/mark-mail-sent.usecase';
import { QueueMailUseCase } from './application/queue-mail.usecase';
import { RejectMailUseCase } from './application/reject-mail.usecase';
import { RequestMailReReviewUseCase } from './application/request-mail-rereview.usecase';
import { RequestMailReviewUseCase } from './application/request-mail-review.usecase';
import { RetryMailUseCase } from './application/retry-mail.usecase';
import { SendQueuedMailUseCase } from './application/send-queued-mail.usecase';
import { RecordMailReplyUseCase } from './application/record-mail-reply.usecase';
import { GenerateMailDraftUseCase } from '../ai/application/generate-mail-draft.usecase';
import { requireLatestConfirmedAnalysis } from '../ai/application/confirmed-analysis.reader';
import { DEFAULT_CHECKLIST_ITEMS } from './mail-checklist.defaults';
import { resolveMailRecipient } from './infrastructure/contact-recipient.resolver';
import { assertLeadContactEligible } from './infrastructure/contact-eligibility.reader';
import {
  CreateMailDraftDto,
  CreateMailReplyDto,
  ImportMailTemplatesDto,
  MarkMailSentDto,
  RejectMailDto,
  SaveMailTemplateDto,
  UpdateMailChecklistDto,
  UpdateMailDto
} from './mail.dto';

@Injectable()
export class MailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestMailReview: RequestMailReviewUseCase,
    private readonly checkMailDraftConsistency: CheckMailDraftConsistencyUseCase,
    private readonly requestMailReReview: RequestMailReReviewUseCase,
    private readonly approveMail: ApproveMailUseCase,
    private readonly rejectMail: RejectMailUseCase,
    private readonly queueMail: QueueMailUseCase,
    private readonly markMailSent: MarkMailSentUseCase,
    private readonly retryMail: RetryMailUseCase,
    private readonly sendQueuedMail: SendQueuedMailUseCase,
    private readonly generateMailDraft: GenerateMailDraftUseCase,
    private readonly recordMailReply: RecordMailReplyUseCase
  ) {}

  async list(page = 1, limit = 20, status?: EmailStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.outreachEmail.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { company: true, lead: { include: { project: { include: { platform: true } } } } }
      }),
      this.prisma.outreachEmail.count({ where })
    ]);

    return { items, page, limit, total };
  }

  listTemplates(channel?: string) {
    return this.prisma.mailTemplate.findMany({
      where: {
        isActive: true,
        ...(channel ? { channel } : {})
      },
      orderBy: [{ channel: 'asc' }, { name: 'asc' }]
    });
  }

  getTemplate(key: string) {
    return this.prisma.mailTemplate.findUnique({ where: { key } });
  }

  saveTemplate(dto: SaveMailTemplateDto) {
    const data = normalizeTemplate(dto);
    return this.prisma.mailTemplate.upsert({
      where: { key: data.key },
      update: data,
      create: data
    });
  }

  async importTemplates(dto: ImportMailTemplatesDto) {
    const templates = [];
    for (const template of dto.templates) {
      templates.push(await this.saveTemplate(template));
    }

    return {
      imported: templates.length,
      templates
    };
  }

  async createDraft(dto: CreateMailDraftDto) {
    const manualInstruction = dto.manualInstruction;
    if (!manualInstruction || !manualInstruction.trim()) {
      const result = await this.generateMailDraft.execute(dto.leadId, {
        templateKey: dto.templateKey,
        analysisRevisionId: dto.analysisRevisionId
      });

      return result.email;
    }

    const lead = await this.prisma.salesLead.findUnique({
      where: { id: dto.leadId },
      include: { company: true, project: { include: { platform: true } } }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const existingMail = await this.prisma.outreachEmail.findFirst({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true }
    });

    if (existingMail) {
      throw new ConflictException('この営業対象には既存メールがあります。履歴からメールを選択して編集・レビューしてください。');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        `mail-draft:${lead.id}`
      );
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        `lead-analysis:${lead.id}`
      );
      const currentLead = await tx.salesLead.findUnique({
        where: { id: lead.id },
        include: { company: true, project: { include: { platform: true } } }
      });
      if (!currentLead) throw new NotFoundException('Lead not found');
      if (!currentLead.project) throw new ConflictException('この営業対象には案件が紐づいていません。');
      const analysisRevision = await requireLatestConfirmedAnalysis(tx, currentLead, dto.analysisRevisionId);
      const recipient = await resolveMailRecipient(tx, currentLead.companyId);
      const destination = await assertLeadContactEligible(tx, currentLead, recipient, { lock: true });
      const concurrentMail = await tx.outreachEmail.findFirst({
        where: { leadId: lead.id },
        select: { id: true }
      });
      if (concurrentMail) {
        throw new ConflictException('この営業対象には既存メールがあります。履歴からメールを選択して編集・レビューしてください。');
      }
      const email = await tx.outreachEmail.create({
        data: {
          leadId: currentLead.id,
          companyId: currentLead.companyId,
          contactId: recipient?.id,
          analysisRevisionId: analysisRevision.id,
          toEmail: recipient?.email,
          destinationType: destination?.type,
          destinationValue: destination?.value,
          destinationKey: destination?.key,
          templateKey: dto.templateKey,
          subject: `${projectPlatformLabel(currentLead.project)}でのプロジェクトを拝見しご連絡いたしました`,
          body: manualInstruction,
          status: 'draft',
          events: { create: { type: 'created' } }
        }
      });

      await tx.salesLead.update({
        where: { id: currentLead.id },
        data: { status: 'drafted' }
      });

      return email;
    });
  }

  update(id: string, dto: UpdateMailDto) {
    return this.prisma.outreachEmail.update({ where: { id }, data: dto });
  }

  requestReview(id: string) {
    return this.requestMailReview.execute(id);
  }

  checkDraftConsistency(id: string) {
    return this.checkMailDraftConsistency.execute(id);
  }

  requestReReview(id: string) {
    return this.requestMailReReview.execute(id);
  }

  approve(id: string) {
    return this.approveMail.execute(id);
  }

  reject(id: string, dto: RejectMailDto) {
    return this.rejectMail.execute(id, dto);
  }

  queue(id: string) {
    return this.queueMail.execute(id);
  }

  markSent(id: string, dto: MarkMailSentDto) {
    return this.markMailSent.execute(id, dto);
  }

  sendQueued(id: string) {
    return this.sendQueuedMail.execute(id);
  }

  async recordReply(id: string, dto: CreateMailReplyDto) {
    return this.recordMailReply.execute(id, dto);
  }

  retry(id: string) {
    return this.retryMail.execute(id);
  }

  cancel(id: string) {
    return this.prisma.outreachEmail.update({
      where: { id },
      data: {
        status: 'cancelled',
        events: { create: { type: 'cancelled' } }
      }
    });
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

}

function normalizeTemplate(dto: SaveMailTemplateDto) {
  return {
    key: dto.key.trim(),
    name: dto.name.trim(),
    channel: (dto.channel || 'email').trim(),
    subject: dto.subject?.trim() || null,
    body: dto.body.trim(),
    description: dto.description?.trim() || null,
    isActive: dto.isActive ?? true
  };
}

function projectPlatformLabel(project?: { platform?: { name?: string | null; type?: string | null } | null; url?: string | null } | null) {
  if (project?.platform?.name) return project.platform.name;
  const type = project?.platform?.type;
  if (type) {
    return (
      {
        campfire: 'CAMPFIRE',
        makuake: 'Makuake',
        green_funding: 'GREEN FUNDING',
        other: 'クラウドファンディング'
      } as Record<string, string>
    )[type] || type;
  }
  const url = project?.url || '';
  if (url.includes('camp-fire.jp')) return 'CAMPFIRE';
  if (url.includes('makuake.com')) return 'Makuake';
  if (url.includes('greenfunding.jp')) return 'GREEN FUNDING';
  return 'クラウドファンディング';
}
