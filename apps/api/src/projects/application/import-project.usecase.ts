import { BadRequestException, Injectable } from '@nestjs/common';
import { ProjectSourceProvider } from '../domain/project-source-provider';
import type { AuditActor } from '../../audit/audit-actor';
import { CampfireProjectSourceProvider } from '../infrastructure/campfire-project-source.provider';
import { MakuakeProjectSourceProvider } from '../infrastructure/makuake-project-source.provider';
import { PrismaProjectImportRepository } from '../infrastructure/prisma-project-import.repository';
import { ImportCampfireProjectDto, ImportProjectDto, ProjectSource } from '../projects.dto';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { ProjectOperationsAuditService } from './project-operations-audit.service';

@Injectable()
export class ImportProjectUseCase {
  constructor(
    private readonly projectImportRepository: PrismaProjectImportRepository,
    private readonly campfireProvider: CampfireProjectSourceProvider,
    private readonly makuakeProvider: MakuakeProjectSourceProvider,
    private readonly logger: StructuredLogger,
    private readonly operationsAudit: ProjectOperationsAuditService
  ) {}

  async import(dto: ImportProjectDto, actor: AuditActor) {
    const provider = this.providerFor(dto.source);
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

  private providerFor(source?: string): ProjectSourceProvider {
    const normalizedSource = normalizeProjectSource(source);
    if (normalizedSource === 'campfire') return this.campfireProvider;
    if (normalizedSource === 'makuake') return this.makuakeProvider;
    throw unsupportedProjectSource(normalizedSource);
  }
}

type ImportOptions = {
  bulk?: boolean;
  actor?: AuditActor | null;
};

function normalizeProjectSource(source?: string): ProjectSource {
  const normalized = (source || 'campfire').trim().toLowerCase().replace('-', '_');
  if (normalized === 'campfire' || normalized === 'makuake' || normalized === 'green_funding') {
    return normalized;
  }
  throw new BadRequestException(`未対応の取得元です: ${source || '未指定'}`);
}

function unsupportedProjectSource(source: ProjectSource) {
  return new BadRequestException(`${sourceLabel(source)}は準備中です。現在はCAMPFIREのみ検索・取り込みできます。`);
}

function sourceLabel(source: ProjectSource) {
  return ({
    campfire: 'CAMPFIRE',
    makuake: 'Makuake',
    green_funding: 'GREEN FUNDING'
  })[source];
}
