import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const LATEST_REQUIRED_MIGRATION = '20260725100000_compliance_tracking';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async readiness(): Promise<{ ready: boolean; migration?: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const rows = await this.prisma.$queryRaw<Array<{ migration_name: string }>>`
        SELECT migration_name
        FROM "_prisma_migrations"
        WHERE migration_name = ${LATEST_REQUIRED_MIGRATION}
          AND finished_at IS NOT NULL
          AND rolled_back_at IS NULL
        LIMIT 1
      `;
      return rows.length === 1
        ? { ready: true, migration: rows[0].migration_name }
        : { ready: false };
    } catch {
      return { ready: false };
    }
  }
}
