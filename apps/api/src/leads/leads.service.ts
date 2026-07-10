import { Injectable, NotFoundException } from '@nestjs/common';
import { LeadPriority, LeadStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto, UpdateLeadDto } from './leads.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 20, status?: LeadStatus, priority?: LeadPriority) {
    const skip = (page - 1) * limit;
    const where = { ...(status ? { status } : {}), ...(priority ? { priority } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.salesLead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: true,
          project: { include: { platform: true } },
          scores: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      }),
      this.prisma.salesLead.count({ where })
    ]);

    return { items: items.map(sanitizeLeadMemos), page, limit, total };
  }

  create(dto: CreateLeadDto) {
    return this.prisma.salesLead.create({
      data: {
        companyId: dto.companyId,
        projectId: dto.projectId,
        source: dto.source ?? 'manual',
        ownerMemo: dto.ownerMemo
      }
    });
  }

  async get(id: string) {
    const lead = await this.prisma.salesLead.findUnique({
      where: { id },
      include: {
        company: true,
        project: { include: { platform: true } },
        scores: { orderBy: { createdAt: 'desc' }, take: 1 }
      }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return sanitizeLeadMemos(lead);
  }

  update(id: string, dto: UpdateLeadDto) {
    return this.prisma.salesLead.update({ where: { id }, data: dto });
  }

  async score(id: string) {
    const lead = await this.get(id);
    const projectAmount = lead.project?.amount ?? 0;
    const supporterCount = lead.project?.supporterCount ?? 0;
    const amountScore = Math.min(30, Math.floor(projectAmount / 1000000) * 5);
    const supporterScore = Math.min(25, Math.floor(supporterCount / 100) * 5);
    const fitScore = lead.project?.category ? 20 : 10;
    const urgencyScore = lead.project?.endDate ? 10 : 5;
    const activityScore = 10;
    const totalScore = amountScore + supporterScore + fitScore + urgencyScore + activityScore;

    const score = await this.prisma.leadScore.create({
      data: {
        leadId: id,
        amountScore,
        supporterScore,
        fitScore,
        urgencyScore,
        activityScore,
        totalScore,
        reasonJson: {
          projectAmount,
          supporterCount,
          note: 'MVP scoring formula. TODO: align with docs/10_AI.md lead score details.'
        }
      }
    });

    await this.prisma.salesLead.update({ where: { id }, data: { score: totalScore } });
    return score;
  }
}

function sanitizeLeadMemos<T extends { project?: { title?: string | null; description?: string | null; category?: string | null } | null; brandAnalysisMemo?: string | null; snsAnalysisMemo?: string | null }>(lead: T): T {
  const source = [lead.project?.title, lead.project?.description, lead.project?.category].filter(Boolean).join(' ');
  return {
    ...lead,
    brandAnalysisMemo: isMemoCompatibleWithProject(lead.brandAnalysisMemo, source) ? lead.brandAnalysisMemo : null,
    snsAnalysisMemo: isMemoCompatibleWithProject(lead.snsAnalysisMemo, source) ? lead.snsAnalysisMemo : null
  };
}

function isMemoCompatibleWithProject(memo?: string | null, projectSource = '') {
  if (!memo || !projectSource) return true;
  const rules = [
    { pattern: /米びつ|米櫃|お米|キッチン|真空保存|鮮度|保存容器|収納/, required: /米びつ|米櫃|お米|キッチン|真空保存|鮮度|保存容器|収納/ },
    { pattern: /醤油差し|醤油|サイフォン|有田焼|陶磁器|器|食卓|残量|ガラス管|NEO CLAY/i, required: /醤油差し|醤油|サイフォン|有田焼|陶磁器|器|食卓|残量|ガラス管|NEO CLAY/i },
    { pattern: /エアベッド|寝心地|車中泊|キャンプ|アウトドア|来客|寝具/, required: /エアベッド|ベッド|寝心地|車中泊|キャンプ|アウトドア|来客|寝具/ },
    { pattern: /ライブ|コンサート|ファン|音楽|バンド|周年|公演/, required: /ライブ|コンサート|ファン|音楽|バンド|周年|公演/ },
    { pattern: /焼き鳥|焼鳥|炭火|店舗|飲食|居酒屋|リフォーム|改装/, required: /焼き鳥|焼鳥|炭火|店舗|飲食|居酒屋|リフォーム|改装/ }
  ];
  return rules.every((rule) => !rule.pattern.test(memo) || rule.required.test(projectSource));
}
