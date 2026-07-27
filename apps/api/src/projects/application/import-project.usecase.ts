import { BadRequestException, Injectable } from '@nestjs/common';
import { ProjectSourceProvider } from '../domain/project-source-provider';
import type { AuditActor } from '../../audit/audit-actor';
import { ProjectSourceRegistry } from '../domain/project-source-registry';
import { PrismaProjectImportRepository } from '../infrastructure/prisma-project-import.repository';
import { ImportCampfireProjectDto, ImportProjectDto } from '../projects.dto';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { ProjectOperationsAuditService } from './project-operations-audit.service';

@Injectable()
export class ImportProjectUseCase {
  constructor(
    private readonly projectImportRepository: PrismaProjectImportRepository,
    private readonly sourceRegistry: ProjectSourceRegistry,
    private readonly logger: StructuredLogger,
    private readonly operationsAudit: ProjectOperationsAuditService
  ) {}

  async import(dto: ImportProjectDto, actor: AuditActor) {
    const provider = this.sourceRegistry.get(dto.source);
    try {
      return await this.importWithProvider(provider, dto.url, actor, { actor });
    } catch (error) {
      await this.operationsAudit.recordDirectImportFailure(actor, provider.source);
      throw error;
    }
  }

  importCampfire(dto: ImportCampfireProjectDto, actor: AuditActor) {
    return this.import({ source: 'campfire', url: dto.url }, actor);
  }

  private async importWithProvider(provider: ProjectSourceProvider, url: string, actor: AuditActor, options: ImportOptions = {}) {
    const normalizedUrl = provider.normalizeUrl(url);
    let imported: Awaited<ReturnType<ProjectSourceProvider['import']>>;
    try {
      imported = await provider.import(normalizedUrl);
    } catch (error) {
      this.logger.errorEvent('scraper.import_failed', {
        organizationId: actor.organizationId,
        userId: actor.userId,
        entityType: 'CrowdfundingProject',
        operation: 'import',
        source: provider.source,
        error
      });
      throw error;
    }

    if (imported.project.status !== 'active') {
      throw new BadRequestException('現在公開中・募集中のプロジェクトだけ取り込めます。終了済み・公開前のURLは対象外です。');
    }
    const result = await this.projectImportRepository.persistImportedProject(actor.organizationId, imported, options);

    return {
      ...result,
      scraped: imported.raw
    };
  }

}

type ImportOptions = {
  bulk?: boolean;
  actor?: AuditActor | null;
};
