import { BadRequestException, Injectable } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import type { AuditActor } from '../../audit/audit-actor';
import { runWithConcurrency } from '../../common/concurrency';
import {
  buildBulkImportSummary,
  BulkImportAnalysisResult,
  BulkImportItemResult,
  clampConcurrency,
  uniqueNormalizedUrlInputs
} from '../domain/project-import-policy';
import { ProjectSourceProvider } from '../domain/project-source-provider';
import { CampfireProjectSourceProvider } from '../infrastructure/campfire-project-source.provider';
import { MakuakeProjectSourceProvider } from '../infrastructure/makuake-project-source.provider';
import { PrismaProjectImportRepository } from '../infrastructure/prisma-project-import.repository';
import { BulkImportProjectsDto, ProjectSource } from '../projects.dto';
import { StructuredLogger } from '../../common/logging/structured-logger.service';

@Injectable()
export class BulkImportProjectsUseCase {
  constructor(
    private readonly ai: AiService,
    private readonly projectImportRepository: PrismaProjectImportRepository,
    private readonly campfireProvider: CampfireProjectSourceProvider,
    private readonly makuakeProvider: MakuakeProjectSourceProvider,
    private readonly logger: StructuredLogger
  ) {}

  async execute(dto: BulkImportProjectsDto, actor: AuditActor) {
    const provider = this.providerFor(dto.source);
    const urlInputs = uniqueNormalizedUrlInputs(dto.urls, (url) => provider.normalizeUrl(url));
    const importConcurrency = clampConcurrency(dto.importConcurrency, 1, 4, 4);
    const analysisConcurrency = clampConcurrency(dto.analysisConcurrency, 1, 4, 3);
    const imported: Array<{ originalUrl: string; url: string; leadId: string; projectId: string; companyId: string }> = [];
    const items: BulkImportItemResult[] = [];

    await runWithConcurrency(urlInputs, importConcurrency, async (item) => {
      try {
        const result = await this.importWithProvider(provider, item.url, actor, { bulk: true, actor });
        imported.push({
          originalUrl: item.originalUrl,
          url: item.url,
          leadId: result.lead.id,
          projectId: result.project.id,
          companyId: result.company.id
        });
        items.push({ originalUrl: item.originalUrl, url: item.url, status: 'imported', leadId: result.lead.id });
      } catch (error) {
        items.push({ originalUrl: item.originalUrl, url: item.url, status: 'failed', message: error instanceof Error ? error.message : '取り込みに失敗しました' });
      }
    });

    const analysisItems: BulkImportAnalysisResult[] = [];
    if (dto.analyze !== false && imported.length) {
      await runWithConcurrency(imported, analysisConcurrency, async (item) => {
        try {
          await this.ai.analyzeLead(item.leadId, actor);
          analysisItems.push({ leadId: item.leadId, status: 'analyzed' });
        } catch (error) {
          analysisItems.push({ leadId: item.leadId, status: 'failed', message: error instanceof Error ? error.message : 'AI分析に失敗しました' });
        }
      });
    }

    const summary = buildBulkImportSummary({
      source: provider.source,
      total: urlInputs.length,
      items,
      analysisItems
    });
    await this.projectImportRepository.recordBulkImportAudit(actor.organizationId, actor, summary);

    return summary;
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
        operation: 'bulk_import',
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
