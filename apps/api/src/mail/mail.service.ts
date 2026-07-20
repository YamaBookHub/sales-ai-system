import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditActor } from '../audit/audit-actor';
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
import { changedMailFields, checklistAuditSummary, mailAuditState, recordMailAudit } from './infrastructure/mail-audit';
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

  async list(organizationId: string, page = 1, limit = 20, status?: EmailStatus) {
    const skip = (page - 1) * limit;
    const where = { organizationId, ...(status ? { status } : {}) };
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

  listTemplates(organizationId: string, channel?: string) {
    return this.prisma.mailTemplate.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(channel ? { channel } : {})
      },
      orderBy: [{ channel: 'asc' }, { name: 'asc' }]
    });
  }

  async getTemplate(organizationId: string, key: string) {
    const template = await this.prisma.mailTemplate.findFirst({ where: { organizationId, key } });
    if (!template) throw new NotFoundException('Mail template not found');
    return template;
  }

  saveTemplate(dto: SaveMailTemplateDto, actor: AuditActor) {
    const data = normalizeTemplate(dto);
    return this.prisma.$transaction((tx) => this.saveTemplateInTransaction(tx, data, actor, 'mail_template.saved'));
  }

  async importTemplates(dto: ImportMailTemplatesDto, actor: AuditActor) {
    return this.prisma.$transaction(async (tx) => {
      const templates = [];
      for (const template of dto.templates) {
        templates.push(await this.saveTemplateInTransaction(
          tx,
          normalizeTemplate(template),
          actor,
          'mail_template.imported'
        ));
      }

      return {
        imported: templates.length,
        templates
      };
    });
  }

  async createDraft(dto: CreateMailDraftDto, actor: AuditActor) {
    const organizationId = actor.organizationId;
    const manualInstruction = dto.manualInstruction;
    if (!manualInstruction || !manualInstruction.trim()) {
      const generationInput = {
        templateKey: dto.templateKey,
        analysisRevisionId: dto.analysisRevisionId
      };
      const result = await this.generateMailDraft.execute(dto.leadId, generationInput, actor);

      return result.email;
    }

    const lead = await this.prisma.salesLead.findFirst({
      where: { id: dto.leadId, organizationId },
      include: { company: true, project: { include: { platform: true } } }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const existingMail = await this.prisma.outreachEmail.findFirst({
      where: { organizationId, leadId: lead.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true }
    });

    if (existingMail) {
      throw new ConflictException('この営業対象には既存メールがあります。履歴からメールを選択して編集・レビューしてください。');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        `mail-draft:${organizationId}:${lead.id}`
      );
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        `lead-analysis:${organizationId}:${lead.id}`
      );
      const currentLead = await tx.salesLead.findFirst({
        where: { id: lead.id, organizationId },
        include: { company: true, project: { include: { platform: true } } }
      });
      if (!currentLead) throw new NotFoundException('Lead not found');
      if (!currentLead.project) throw new ConflictException('この営業対象には案件が紐づいていません。');
      const analysisRevision = await requireLatestConfirmedAnalysis(tx, currentLead, dto.analysisRevisionId);
      const recipient = await resolveMailRecipient(tx, currentLead.companyId, organizationId);
      const destination = await assertLeadContactEligible(tx, currentLead, recipient, { lock: true });
      const concurrentMail = await tx.outreachEmail.findFirst({
        where: { organizationId, leadId: lead.id },
        select: { id: true }
      });
      if (concurrentMail) {
        throw new ConflictException('この営業対象には既存メールがあります。履歴からメールを選択して編集・レビューしてください。');
      }
      const email = await tx.outreachEmail.create({
        data: {
          organizationId,
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
          // The nested relation uses the parent email's organizationId.
          events: { create: { type: 'created', payload: { actorUserId: actor.userId } } }
        }
      });

      await tx.salesLead.update({
        where: { organizationId_id: { organizationId, id: currentLead.id } },
        data: { status: 'drafted' }
      });
      await recordMailAudit(tx, actor, 'mail.created', email.id, {
        after: mailAuditState(email)
      });

      return email;
    });
  }

  update(id: string, dto: UpdateMailDto, actor: AuditActor) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.outreachEmail.findFirst({ where: { id, organizationId: actor.organizationId } });
      if (!before) throw new NotFoundException('Mail not found');
      const edit = changedMailFields(before, dto);
      const email = await tx.outreachEmail.update({
        where: { organizationId_id: { organizationId: actor.organizationId, id } },
        data: {
          ...dto,
          // The nested relation uses the parent email's organizationId.
          events: { create: { type: 'reviewed', payload: { edited: true, actorUserId: actor.userId } } }
        }
      });
      await recordMailAudit(tx, actor, 'mail.edited', id, {
        before: mailAuditState(before),
        after: { ...mailAuditState(email), ...edit }
      });
      return email;
    });
  }

  requestReview(id: string, actor: AuditActor) {
    return this.requestMailReview.execute(id, actor);
  }

  checkDraftConsistency(id: string, organizationId: string) {
    return this.checkMailDraftConsistency.execute(id, organizationId);
  }

  requestReReview(id: string, actor: AuditActor) {
    return this.requestMailReReview.execute(id, actor);
  }

  approve(id: string, actor: AuditActor) {
    return this.approveMail.execute(id, actor);
  }

  reject(id: string, dto: RejectMailDto, actor: AuditActor) {
    return this.rejectMail.execute(id, dto, actor);
  }

  queue(id: string, actor: AuditActor) {
    return this.queueMail.execute(id, actor);
  }

  markSent(id: string, dto: MarkMailSentDto, actor: AuditActor) {
    return this.markMailSent.execute(id, dto, actor);
  }

  sendQueued(id: string, actor: AuditActor) {
    return this.sendQueuedMail.execute(id, actor);
  }

  async recordReply(id: string, dto: CreateMailReplyDto, actor: AuditActor) {
    return this.recordMailReply.execute(id, dto, actor);
  }

  retry(id: string, actor: AuditActor) {
    return this.retryMail.execute(id, actor);
  }

  cancel(id: string, actor: AuditActor) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.outreachEmail.findFirst({ where: { id, organizationId: actor.organizationId } });
      if (!before) throw new NotFoundException('Mail not found');
      const email = await tx.outreachEmail.update({
        where: { organizationId_id: { organizationId: actor.organizationId, id } },
        data: {
          status: 'cancelled',
          // The nested relation uses the parent email's organizationId.
          events: { create: { type: 'cancelled', payload: { actorUserId: actor.userId } } }
        }
      });
      await recordMailAudit(tx, actor, 'mail.cancelled', id, {
        before: mailAuditState(before),
        after: mailAuditState(email)
      });
      return email;
    });
  }

  async getChecklist(emailId: string, organizationId: string) {
    await this.get(emailId, organizationId);
    await this.ensureDefaultChecklist(emailId, organizationId);
    const items = await this.prisma.mailChecklistItem.findMany({
      where: { organizationId, emailId },
      orderBy: { createdAt: 'asc' }
    });

    return {
      items,
      complete: items.length > 0 && items.every((item) => item.checked)
    };
  }

  async updateChecklist(emailId: string, dto: UpdateMailChecklistDto, actor: AuditActor) {
    const organizationId = actor.organizationId;
    await this.get(emailId, organizationId);
    const now = new Date();
    const items = dto.items.length ? dto.items : DEFAULT_CHECKLIST_ITEMS.map((item) => ({ ...item, checked: false }));

    await this.prisma.$transaction(async (tx) => {
      const email = await tx.outreachEmail.findFirst({ where: { id: emailId, organizationId } });
      if (!email) throw new NotFoundException('Mail not found');
      for (const item of items) {
        await tx.mailChecklistItem.upsert({
          where: { organizationId_emailId_key: { organizationId, emailId, key: item.key } },
          update: {
            label: item.label,
            checked: item.checked,
            checkedAt: item.checked ? now : null
          },
          create: {
            organizationId,
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
          organizationId,
          emailId,
          type: 'reviewed',
          payload: {
            checklistUpdated: true,
            complete: items.every((item) => item.checked),
            checkedCount: items.filter((item) => item.checked).length,
            totalCount: items.length,
            actorUserId: actor.userId
          }
        }
      });
      await recordMailAudit(tx, actor, 'mail.checklist_updated', emailId, {
        before: mailAuditState(email),
        after: { ...mailAuditState(email), ...checklistAuditSummary(items) }
      });
    });

    return this.getChecklist(emailId, organizationId);
  }

  async getThread(gmailThreadId: string, organizationId: string) {
    const emails = await this.prisma.outreachEmail.findMany({ where: { organizationId, gmailThreadId } });
    if (!emails.length) {
      throw new NotFoundException('Mail thread not found');
    }
    const replies = await this.prisma.emailReply.findMany({ where: { organizationId, email: { organizationId, gmailThreadId } } });
    return { gmailThreadId, emails, replies };
  }

  private async saveTemplateInTransaction(
    tx: Prisma.TransactionClient,
    data: ReturnType<typeof normalizeTemplate>,
    actor: AuditActor,
    action: 'mail_template.saved' | 'mail_template.imported'
  ) {
    const before = await tx.mailTemplate.findFirst({
      where: { organizationId: actor.organizationId, key: data.key },
      select: { id: true, key: true, channel: true, isActive: true }
    });
    const template = await tx.mailTemplate.upsert({
      where: { organizationId_key: { organizationId: actor.organizationId, key: data.key } },
      update: data,
      create: { organizationId: actor.organizationId, ...data }
    });

    await recordMailAudit(tx, actor, action, template.id, {
      before: templateAuditState(before),
      after: templateAuditState(template)
    }, 'MailTemplate');

    return template;
  }

  private async get(id: string, organizationId: string) {
    const email = await this.prisma.outreachEmail.findFirst({ where: { id, organizationId } });

    if (!email) {
      throw new NotFoundException('Mail not found');
    }

    return email;
  }

  private async ensureDefaultChecklist(emailId: string, organizationId: string) {
    const count = await this.prisma.mailChecklistItem.count({ where: { organizationId, emailId } });
    if (count > 0) return;

    await this.prisma.mailChecklistItem.createMany({
      data: DEFAULT_CHECKLIST_ITEMS.map((item) => ({
        organizationId,
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

function templateAuditState(template: { key: string; channel: string; isActive: boolean } | null) {
  if (!template) return { exists: false };
  return {
    exists: true,
    key: template.key,
    channel: template.channel,
    isActive: template.isActive
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
