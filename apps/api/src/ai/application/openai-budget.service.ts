import { Injectable } from '@nestjs/common';
import { AiUsageStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertOpenAiBudgetAvailable,
  buildOpenAiUsageSummary,
  estimateOpenAiRequestCost,
  openAiMonthRange,
  OPENAI_RESERVATION_TTL_MS,
  readOpenAiBudgetConfig,
  roundUsd
} from '../domain/openai-budget';

type MeteredOpenAiResult = {
  usage?: { costUsd?: number };
};

@Injectable()
export class OpenAiBudgetService {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T extends MeteredOpenAiResult>(
    input: { organizationId: string; model: string; operation: string; requestInput: unknown; maxOutputTokens: number },
    run: () => Promise<T>
  ): Promise<T> {
    const now = new Date();
    const config = readOpenAiBudgetConfig();
    const estimatedCostUsd = estimateOpenAiRequestCost(input.requestInput, input.maxOutputTokens, config);
    const reservation = await this.reserve({ ...input, estimatedCostUsd, now, budgetUsd: config.budgetUsd });

    let result: T;
    try {
      result = await run();
    } catch (error) {
      await this.prisma.aiUsageLedger.update({
        where: { organizationId_id: { organizationId: input.organizationId, id: reservation.id } },
        data: {
          status: AiUsageStatus.failed,
          actualCostUsd: estimatedCostUsd,
          completedAt: new Date()
        }
      }).catch(() => undefined);
      throw error;
    }

    const actualCostUsd = roundUsd(result.usage?.costUsd ?? estimatedCostUsd);
    await this.prisma.aiUsageLedger.update({
      where: { organizationId_id: { organizationId: input.organizationId, id: reservation.id } },
      data: { status: AiUsageStatus.completed, actualCostUsd, completedAt: new Date() }
    });
    return result;
  }

  async getUsageSummary(organizationId: string, now = new Date()) {
    const config = readOpenAiBudgetConfig();
    const usage = await this.monthUsage(organizationId, now);
    return buildOpenAiUsageSummary({ now, budgetUsd: config.budgetUsd, ...usage });
  }

  private async reserve(input: {
    organizationId: string;
    model: string;
    operation: string;
    estimatedCostUsd: number;
    now: Date;
    budgetUsd: number | null;
  }) {
    const range = openAiMonthRange(input.now);
    const staleBefore = new Date(input.now.getTime() - OPENAI_RESERVATION_TTL_MS);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`openai-monthly-budget:${input.organizationId}`}))`;
      await tx.aiUsageLedger.updateMany({
        where: { organizationId: input.organizationId, provider: 'openai', status: AiUsageStatus.reserved, createdAt: { lt: staleBefore } },
        data: { status: AiUsageStatus.failed, completedAt: input.now }
      });

      const rows = await tx.aiUsageLedger.findMany({
        where: {
          organizationId: input.organizationId,
          provider: 'openai',
          createdAt: { gte: range.start, lt: range.end },
          OR: [
            { status: AiUsageStatus.completed },
            { status: AiUsageStatus.failed },
            { status: AiUsageStatus.reserved }
          ]
        },
        select: { status: true, estimatedCostUsd: true, actualCostUsd: true }
      });
      const usage = sumUsageRows(rows);
      assertOpenAiBudgetAvailable({ ...usage, budgetUsd: input.budgetUsd, estimatedCostUsd: input.estimatedCostUsd });

      return tx.aiUsageLedger.create({
        data: {
          organizationId: input.organizationId,
          provider: 'openai',
          model: input.model,
          operation: input.operation,
          status: AiUsageStatus.reserved,
          estimatedCostUsd: input.estimatedCostUsd
        },
        select: { id: true }
      });
    });
  }

  private async monthUsage(organizationId: string, now: Date) {
    const range = openAiMonthRange(now);
    const rows = await this.prisma.aiUsageLedger.findMany({
      where: {
        organizationId,
        provider: 'openai',
        createdAt: { gte: range.start, lt: range.end },
        OR: [
          { status: AiUsageStatus.completed },
          { status: AiUsageStatus.failed },
          { status: AiUsageStatus.reserved }
        ]
      },
      select: { status: true, estimatedCostUsd: true, actualCostUsd: true }
    });
    return sumUsageRows(rows);
  }
}

function sumUsageRows(rows: Array<{
  status: AiUsageStatus;
  estimatedCostUsd: { toString(): string } | number;
  actualCostUsd: { toString(): string } | number | null;
}>) {
  return rows.reduce(
    (sum, row) => {
      if (row.status === AiUsageStatus.completed || row.status === AiUsageStatus.failed) {
        sum.spentUsd += Number(row.actualCostUsd ?? row.estimatedCostUsd);
      } else if (row.status === AiUsageStatus.reserved) {
        sum.reservedUsd += Number(row.estimatedCostUsd);
      }
      return sum;
    },
    { spentUsd: 0, reservedUsd: 0 }
  );
}
