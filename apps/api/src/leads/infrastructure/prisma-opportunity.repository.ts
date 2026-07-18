import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  OpportunityLossReason,
  OpportunityStage,
  PlatformType,
  Prisma
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OpportunityPolicyFailureReason,
  OpportunityRole,
  canEditOpportunityFields,
  evaluateOpportunityReopen,
  evaluateOpportunityTransition,
  isTerminalOpportunityStage
} from '../domain/opportunity-policy';

export type OpportunityActor = {
  userId: string | null;
  role: OpportunityRole;
};

export type OpportunityListInput = {
  page?: number;
  limit?: number;
  stage?: OpportunityStage;
  ownerId?: string;
  source?: PlatformType;
  expectedCloseFrom?: string;
  expectedCloseTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
};

export type OpportunityDetailsInput = {
  expectedVersion: number;
  ownerId?: string | null;
  probability?: number;
  expectedAmount?: number | null;
  meetingScheduledAt?: string | null;
  expectedCloseDate?: string | null;
};

export type OpportunityTransitionRecord = {
  expectedVersion: number;
  operationKey: string;
  toStage: OpportunityStage;
  reason?: string;
  probability?: number;
  expectedAmount?: number;
  meetingScheduledAt?: string | null;
  expectedCloseDate?: string | null;
  wonAmount?: number;
  lossReason?: OpportunityLossReason;
  lossReasonDetail?: string;
};

export type OpportunityReopenRecord = {
  expectedVersion: number;
  operationKey: string;
  toStage: OpportunityStage;
  reason: string;
};

const opportunityInclude: Prisma.OpportunityInclude = {
  owner: { select: { id: true, name: true, email: true } },
  lead: {
    include: {
      company: true,
      project: { include: { platform: true } },
      tasks: {
        where: { status: { in: ['todo', 'doing'] } },
        orderBy: [{ dueAt: 'asc' as const }, { createdAt: 'asc' as const }],
        take: 1,
        include: { assignee: { select: { id: true, name: true, email: true } } }
      }
    }
  }
};

@Injectable()
export class PrismaOpportunityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: OpportunityListInput) {
    const page = Math.max(1, input.page || 1);
    const limit = Math.min(100, Math.max(1, input.limit || 20));
    const where: Prisma.OpportunityWhereInput = {
      ...(input.stage ? { stage: input.stage } : {}),
      ...(input.ownerId ? { ownerId: input.ownerId } : {}),
      lead: {
        deletedAt: null,
        ...(input.source ? { project: { platform: { type: input.source } } } : {})
      },
      ...dateRange('expectedCloseDate', input.expectedCloseFrom, input.expectedCloseTo),
      ...dateRange('updatedAt', input.updatedFrom, input.updatedTo)
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.opportunity.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        include: opportunityInclude
      }),
      this.prisma.opportunity.count({ where })
    ]);
    return { items, page, limit, total };
  }

  async getByLeadId(leadId: string) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { leadId, lead: { deletedAt: null } },
      include: {
        ...opportunityInclude,
        history: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 10,
          include: { changedBy: { select: { id: true, name: true, email: true } } }
        }
      }
    });
    if (opportunity) return opportunity;
    await this.assertLeadExists(leadId);
    throw new ConflictException('この営業対象の商談情報が未作成です。データ移行状態を確認してください。');
  }

  async listHistory(leadId: string, page = 1, limit = 20) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { leadId, lead: { deletedAt: null } },
      select: { id: true }
    });
    if (!opportunity) {
      await this.assertLeadExists(leadId);
      throw new ConflictException('この営業対象の商談情報が未作成です。データ移行状態を確認してください。');
    }
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(100, Math.max(1, limit));
    const where = { opportunityId: opportunity.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.opportunityStageHistory.findMany({
        where,
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { changedBy: { select: { id: true, name: true, email: true } } }
      }),
      this.prisma.opportunityStageHistory.count({ where })
    ]);
    return { items, page: normalizedPage, limit: normalizedLimit, total };
  }

  updateDetails(leadId: string, input: OpportunityDetailsInput, actor: OpportunityActor) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lockedOpportunity(tx, leadId);
      assertExpectedVersion(current.version, input.expectedVersion, current.stage);
      const ownsOpportunity = !current.ownerId || current.ownerId === actor.userId;
      if (!canEditOpportunityFields(actor.role, ownsOpportunity)) throw new ForbiddenException('この商談を編集する権限がありません。');
      if (input.ownerId && !(await activeUserExists(tx, input.ownerId))) {
        throw new BadRequestException('担当者が存在しないか、無効です。');
      }
      if (input.probability !== undefined && !validPercentage(input.probability)) {
        throw new BadRequestException('確度は0から100の整数で入力してください。');
      }
      if (input.expectedAmount !== undefined && input.expectedAmount !== null && !nonNegativeInteger(input.expectedAmount)) {
        throw new BadRequestException('見込金額は0以上の整数で入力してください。');
      }

      const before = opportunityAuditSnapshot(current);
      const updated = await tx.opportunity.update({
        where: { id: current.id },
        data: {
          ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
          ...(input.probability !== undefined ? { probability: input.probability } : {}),
          ...(input.expectedAmount !== undefined ? { expectedAmount: input.expectedAmount } : {}),
          ...(input.meetingScheduledAt !== undefined ? { meetingScheduledAt: parseNullableDate(input.meetingScheduledAt) } : {}),
          ...(input.expectedCloseDate !== undefined ? { expectedCloseDate: parseNullableDate(input.expectedCloseDate) } : {}),
          version: { increment: 1 }
        },
        include: opportunityInclude
      });
      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'opportunity.updated',
          entityType: 'Opportunity',
          entityId: current.id,
          before,
          after: opportunityAuditSnapshot(updated)
        }
      });
      return updated;
    });
  }

  transition(leadId: string, input: OpportunityTransitionRecord, actor: OpportunityActor) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lockedOpportunity(tx, leadId);
      const duplicate = await idempotentHistory(tx, current.id, input.operationKey, transitionRequestSnapshot(input, false));
      if (duplicate) return tx.opportunity.findUniqueOrThrow({ where: { id: current.id }, include: opportunityInclude });
      assertExpectedVersion(current.version, input.expectedVersion, current.stage);
      if (isTerminalOpportunityStage(input.toStage) && !input.reason?.trim()) {
        throw new BadRequestException('受注・失注・対象外へ変更する理由を入力してください。');
      }
      const result = evaluateOpportunityTransition({
        currentStage: current.stage,
        toStage: input.toStage,
        role: actor.role,
        isOwnerOrUnassigned: !current.ownerId || current.ownerId === actor.userId,
        probability: input.probability,
        wonAmount: input.wonAmount,
        lossReason: input.lossReason,
        lossReasonDetail: input.lossReasonDetail
      });
      if (!result.ok) throwOpportunityPolicyError(result.reason);
      return persistTransition(tx, current, input, actor, result.probability, false);
    });
  }

  reopen(leadId: string, input: OpportunityReopenRecord, actor: OpportunityActor) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lockedOpportunity(tx, leadId);
      const duplicate = await idempotentHistory(tx, current.id, input.operationKey, transitionRequestSnapshot(input, true));
      if (duplicate) return tx.opportunity.findUniqueOrThrow({ where: { id: current.id }, include: opportunityInclude });
      assertExpectedVersion(current.version, input.expectedVersion, current.stage);
      const result = evaluateOpportunityReopen({
        currentStage: current.stage,
        toStage: input.toStage,
        role: actor.role,
        reason: input.reason
      });
      if (!result.ok) throwOpportunityPolicyError(result.reason);
      return persistTransition(tx, current, input, actor, result.probability, true);
    });
  }

  private async lockedOpportunity(tx: Prisma.TransactionClient, leadId: string) {
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `opportunity:${leadId}`);
    const opportunity = await tx.opportunity.findFirst({ where: { leadId, lead: { deletedAt: null } } });
    if (opportunity) return opportunity;
    const lead = await tx.salesLead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true } });
    if (!lead) throw new NotFoundException('Lead not found');
    throw new ConflictException('この営業対象の商談情報が未作成です。データ移行状態を確認してください。');
  }

  private async assertLeadExists(leadId: string) {
    const lead = await this.prisma.salesLead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true } });
    if (!lead) throw new NotFoundException('Lead not found');
  }
}

export async function ensureOpportunityForLead(tx: Prisma.TransactionClient, leadId: string) {
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `opportunity:${leadId}`);
  const existing = await tx.opportunity.findUnique({ where: { leadId } });
  if (existing) return existing;
  const opportunity = await tx.opportunity.create({ data: { leadId } });
  await tx.opportunityStageHistory.create({
    data: {
      opportunityId: opportunity.id,
      fromStage: null,
      toStage: 'uncontacted',
      source: 'system',
      sourceId: leadId,
      reason: 'lead_created',
      operationKey: `bootstrap:opportunity:${leadId}`,
      versionAfter: opportunity.version,
      snapshot: opportunitySnapshot(opportunity)
    }
  });
  return opportunity;
}

export async function progressOpportunityInTransaction(
  tx: Prisma.TransactionClient,
  input: { leadId: string; toStage: 'contacted' | 'replied' | 'meeting'; sourceId: string; operationKey: string }
) {
  const opportunity = await ensureOpportunityForLead(tx, input.leadId);
  const existing = await tx.opportunityStageHistory.findUnique({ where: { operationKey: input.operationKey } });
  if (existing) return opportunity;
  if (!shouldProgress(opportunity.stage, input.toStage)) return opportunity;
  const result = evaluateOpportunityTransition({
    currentStage: opportunity.stage,
    toStage: input.toStage,
    role: 'system'
  });
  if (!result.ok) return opportunity;
  const updated = await tx.opportunity.update({
    where: { id: opportunity.id },
    data: {
      stage: input.toStage,
      probability: result.probability,
      stageChangedAt: new Date(),
      version: { increment: 1 }
    }
  });
  await tx.opportunityStageHistory.create({
    data: {
      opportunityId: opportunity.id,
      fromStage: opportunity.stage,
      toStage: input.toStage,
      source: 'system',
      sourceId: input.sourceId,
      reason: 'workflow_progress',
      operationKey: input.operationKey,
      versionAfter: updated.version,
      snapshot: opportunitySnapshot(updated)
    }
  });
  return updated;
}

async function persistTransition(
  tx: Prisma.TransactionClient,
  current: Prisma.OpportunityGetPayload<Record<string, never>>,
  input: OpportunityTransitionRecord | OpportunityReopenRecord,
  actor: OpportunityActor,
  probability: number,
  reopen: boolean
) {
  const now = new Date();
  const transitionInput = input as OpportunityTransitionRecord;
  const terminal = isTerminalOpportunityStage(input.toStage);
  const data: Prisma.OpportunityUpdateInput = {
    stage: input.toStage,
    probability,
    stageChangedAt: now,
    version: { increment: 1 },
    ...(transitionInput.expectedAmount !== undefined ? { expectedAmount: transitionInput.expectedAmount } : {}),
    ...(transitionInput.meetingScheduledAt !== undefined ? { meetingScheduledAt: parseNullableDate(transitionInput.meetingScheduledAt) } : {}),
    ...(transitionInput.expectedCloseDate !== undefined ? { expectedCloseDate: parseNullableDate(transitionInput.expectedCloseDate) } : {})
  };
  if (input.toStage === 'won') {
    Object.assign(data, { wonAmount: transitionInput.wonAmount, wonAt: now, lostAt: null, lossReason: null, lossReasonDetail: null });
  } else if (input.toStage === 'lost') {
    Object.assign(data, {
      wonAmount: null,
      wonAt: null,
      lostAt: now,
      lossReason: transitionInput.lossReason,
      lossReasonDetail: transitionInput.lossReasonDetail?.trim() || null
    });
  } else if (reopen || input.toStage === 'excluded') {
    Object.assign(data, { wonAmount: null, wonAt: null, lostAt: null, lossReason: null, lossReasonDetail: null });
  }
  const updated = await tx.opportunity.update({ where: { id: current.id }, data, include: opportunityInclude });
  await tx.opportunityStageHistory.create({
    data: {
      opportunityId: current.id,
      fromStage: current.stage,
      toStage: input.toStage,
      changedById: actor.userId,
      source: 'manual',
      reason: input.reason?.trim() || null,
      operationKey: input.operationKey,
      versionAfter: updated.version,
      snapshot: {
        ...opportunitySnapshot(updated),
        request: transitionRequestSnapshot(input, reopen)
      }
    }
  });
  if (terminal) {
    await tx.salesLead.update({ where: { id: current.leadId }, data: { nextActionAt: null, nextFollowUpAt: null } });
    await tx.task.updateMany({
      where: { leadId: current.leadId, status: { in: ['todo', 'doing'] } },
      data: { status: 'cancelled', doneAt: null }
    });
  }
  return updated;
}

async function idempotentHistory(
  tx: Prisma.TransactionClient,
  opportunityId: string,
  operationKey: string,
  request: Prisma.InputJsonObject
) {
  const history = await tx.opportunityStageHistory.findUnique({ where: { operationKey } });
  if (!history) return null;
  const snapshot = isJsonObject(history.snapshot) ? history.snapshot : null;
  if (
    history.opportunityId !== opportunityId ||
    history.toStage !== request.toStage ||
    !sameJson(snapshot?.request, request)
  ) {
    throw new ConflictException('同じ操作キーが別の商談更新に使用されています。');
  }
  return history;
}

function shouldProgress(current: OpportunityStage, target: 'contacted' | 'replied' | 'meeting') {
  const ranks: Record<OpportunityStage, number> = {
    uncontacted: 0,
    contacted: 1,
    replied: 2,
    meeting: 3,
    proposal: 4,
    won: 5,
    lost: 5,
    excluded: 5
  };
  return ranks[target] > ranks[current];
}

function assertExpectedVersion(current: number, expected: number, stage: OpportunityStage) {
  if (current !== expected) {
    throw new ConflictException({
      message: '商談情報が別の操作で更新されました。再読込してください。',
      currentVersion: current,
      currentStage: stage
    });
  }
}

function throwOpportunityPolicyError(reason: OpportunityPolicyFailureReason): never {
  if (['forbidden_role', 'owner_scope_required'].includes(reason)) {
    throw new ForbiddenException('この商談状態を変更する権限がありません。');
  }
  if (['invalid_probability', 'won_amount_required', 'invalid_won_amount', 'loss_reason_required', 'loss_reason_detail_required', 'loss_reason_not_allowed', 'reopen_reason_required'].includes(reason)) {
    throw new BadRequestException(opportunityPolicyMessage(reason));
  }
  throw new ConflictException(opportunityPolicyMessage(reason));
}

function opportunityPolicyMessage(reason: OpportunityPolicyFailureReason) {
  const messages: Record<OpportunityPolicyFailureReason, string> = {
    same_stage: 'すでに同じ商談状態です。',
    invalid_transition: 'この商談状態への遷移は許可されていません。',
    terminal_stage: '終了した商談は通常操作では変更できません。再開操作を使用してください。',
    forbidden_role: 'この操作を行う権限がありません。',
    owner_scope_required: '自分が担当する商談だけ変更できます。',
    system_transition_not_allowed: 'システム処理ではこの商談状態へ進められません。',
    invalid_probability: '確度は0から100の整数で入力してください。',
    won_amount_required: '受注金額を入力してください。',
    invalid_won_amount: '受注金額は0以上の整数で入力してください。',
    loss_reason_required: '失注理由を選択してください。',
    loss_reason_detail_required: 'その他の失注理由を入力してください。',
    loss_reason_not_allowed: '失注以外の状態には失注理由を設定できません。',
    reopen_not_allowed: 'この商談状態は再開できません。',
    reopen_target_not_allowed: '再開先の商談状態が不正です。',
    reopen_reason_required: '再開理由を入力してください。'
  };
  return messages[reason];
}

function opportunitySnapshot(value: {
  stage: OpportunityStage;
  ownerId?: string | null;
  probability: number;
  expectedAmount?: number | null;
  wonAmount?: number | null;
  meetingScheduledAt?: Date | null;
  expectedCloseDate?: Date | null;
  wonAt?: Date | null;
  lostAt?: Date | null;
  lossReason?: OpportunityLossReason | null;
  lossReasonDetail?: string | null;
}) {
  return {
    stage: value.stage,
    ownerId: value.ownerId ?? null,
    probability: value.probability,
    expectedAmount: value.expectedAmount ?? null,
    wonAmount: value.wonAmount ?? null,
    meetingScheduledAt: value.meetingScheduledAt?.toISOString() ?? null,
    expectedCloseDate: value.expectedCloseDate?.toISOString() ?? null,
    wonAt: value.wonAt?.toISOString() ?? null,
    lostAt: value.lostAt?.toISOString() ?? null,
    lossReason: value.lossReason ?? null,
    lossReasonDetail: value.lossReasonDetail ?? null
  } satisfies Prisma.InputJsonObject;
}

function opportunityAuditSnapshot(value: Parameters<typeof opportunitySnapshot>[0]) {
  return opportunitySnapshot(value);
}

function dateRange(field: 'expectedCloseDate' | 'updatedAt', from?: string, to?: string): Prisma.OpportunityWhereInput {
  if (!from && !to) return {};
  return { [field]: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } };
}

function transitionRequestSnapshot(
  input: OpportunityTransitionRecord | OpportunityReopenRecord,
  reopen: boolean
): Prisma.InputJsonObject {
  const transition = input as OpportunityTransitionRecord;
  return {
    kind: reopen ? 'reopen' : 'transition',
    expectedVersion: input.expectedVersion,
    toStage: input.toStage,
    reason: input.reason?.trim() || null,
    probability: transition.probability ?? null,
    expectedAmount: transition.expectedAmount ?? null,
    meetingScheduledAt: transition.meetingScheduledAt ?? null,
    expectedCloseDate: transition.expectedCloseDate ?? null,
    wonAmount: transition.wonAmount ?? null,
    lossReason: transition.lossReason ?? null,
    lossReasonDetail: transition.lossReasonDetail?.trim() || null
  };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!isJsonObject(value)) return value;
  return Object.keys(value).sort().reduce<Record<string, unknown>>((result, key) => {
    result[key] = canonicalJson(value[key]);
    return result;
  }, {});
}

function parseNullableDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function validPercentage(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

function nonNegativeInteger(value: number) {
  return Number.isInteger(value) && value >= 0;
}

async function activeUserExists(tx: Prisma.TransactionClient, id: string) {
  return Boolean(await tx.user.findFirst({ where: { id, isActive: true, deletedAt: null }, select: { id: true } }));
}
