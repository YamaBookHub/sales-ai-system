import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailStatus, LeadStatus, ReplyCategory } from '@prisma/client';
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
import { DEFAULT_CHECKLIST_ITEMS } from './mail-checklist.defaults';
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
    private readonly sendQueuedMail: SendQueuedMailUseCase
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
      const email = await tx.outreachEmail.create({
        data: {
          leadId: lead.id,
          companyId: lead.companyId,
          templateKey: dto.templateKey,
          subject: `${projectPlatformLabel(lead.project)}でのプロジェクトを拝見しご連絡いたしました`,
          body: dto.manualInstruction ?? 'TODO: AI-generated draft body will be inserted here.',
          status: 'draft',
          events: { create: { type: 'created' } }
        }
      });

      await tx.salesLead.update({
        where: { id: lead.id },
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
    const email = await this.get(id);
    const classification = classifyReplyText(dto.body);
    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const reply = await tx.emailReply.create({
        data: {
          emailId: id,
          fromEmail: dto.fromEmail,
          body: dto.body,
          bodyText: dto.body,
          category: classification.category,
          confidence: classification.confidence,
          summary: classification.summary,
          nextAction: classification.nextAction,
          receivedAt
        }
      });

      await tx.emailEvent.create({
        data: {
          emailId: id,
          type: 'replied',
          payload: {
            category: classification.category,
            confidence: classification.confidence
          }
        }
      });

      if (email.leadId) {
        await tx.salesLead.update({
          where: { id: email.leadId },
          data: {
            status: classification.leadStatus,
            nextActionAt: classification.nextActionAt
          }
        });
      }

      return { reply, classification };
    });
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

function classifyReplyText(body: string): {
  category: ReplyCategory;
  confidence: number;
  summary: string;
  nextAction: string;
  leadStatus: LeadStatus;
  nextActionAt?: Date;
} {
  const text = body.replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  if (/配信停止|停止|不要|unsubscribe|今後.*不要/.test(lower)) {
    return {
      category: 'unsubscribe',
      confidence: 0.9,
      summary: '配信停止または今後不要の返信です。',
      nextAction: '対象外にし、以後の連絡を止める。',
      leadStatus: 'rejected'
    };
  }

  if (/打ち合わせ|商談|面談|日程|候補日|zoom|ミーティング|meeting/.test(lower)) {
    return {
      category: 'meeting_request',
      confidence: 0.86,
      summary: '面談または日程調整につながる返信です。',
      nextAction: '日程候補または調整リンクを送る。',
      leadStatus: 'meeting_candidate',
      nextActionAt: tomorrow
    };
  }

  if (/資料|詳しく|詳細|料金|費用|教えて|知りたい|興味|検討/.test(lower)) {
    return {
      category: 'need_info',
      confidence: 0.78,
      summary: '追加情報や資料を求めている可能性があります。',
      nextAction: '質問に回答し、必要なら資料や説明を送る。',
      leadStatus: 'replied',
      nextActionAt: tomorrow
    };
  }

  if (/興味ありません|不要です|結構です|お断り|予算.*ない|時期.*違/.test(lower)) {
    return {
      category: 'not_interested',
      confidence: 0.82,
      summary: '現時点では見送りまたは不要の返信です。',
      nextAction: '無理に追わず、必要なら時期を空けて再確認する。',
      leadStatus: 'no_response'
    };
  }

  if (/自動返信|不在|休暇|auto.?reply|out of office/.test(lower)) {
    return {
      category: 'auto_reply',
      confidence: 0.88,
      summary: '自動返信の可能性があります。',
      nextAction: '通常返信を待ち、必要なら数日後に確認する。',
      leadStatus: 'contacted',
      nextActionAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    };
  }

  return {
    category: 'unknown',
    confidence: 0.4,
    summary: text.slice(0, 120) || '返信内容を確認してください。',
    nextAction: '返信内容を確認し、次対応を判断する。',
    leadStatus: 'replied',
    nextActionAt: tomorrow
  };
}
