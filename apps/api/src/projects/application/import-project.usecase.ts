import { BadRequestException, Injectable } from '@nestjs/common';
import { ProjectActor } from '../domain/project-actor';
import { ProjectSourceProvider } from '../domain/project-source-provider';
import { CampfireProjectSourceProvider } from '../infrastructure/campfire-project-source.provider';
import { MakuakeProjectSourceProvider } from '../infrastructure/makuake-project-source.provider';
import { PrismaProjectImportRepository } from '../infrastructure/prisma-project-import.repository';
import { ImportCampfireProjectDto, ImportProjectDto, ProjectSource } from '../projects.dto';

@Injectable()
export class ImportProjectUseCase {
  constructor(
    private readonly projectImportRepository: PrismaProjectImportRepository,
    private readonly campfireProvider: CampfireProjectSourceProvider,
    private readonly makuakeProvider: MakuakeProjectSourceProvider
  ) {}

  import(dto: ImportProjectDto, actor: ProjectActor = {}) {
    return this.importWithProvider(this.providerFor(dto.source), dto.url, { actor });
  }

  importCampfire(dto: ImportCampfireProjectDto, actor: ProjectActor = {}) {
    return this.import({ source: 'campfire', url: dto.url }, actor);
  }

  private async importWithProvider(provider: ProjectSourceProvider, url: string, options: ImportOptions = {}) {
    const normalizedUrl = provider.normalizeUrl(url);
    const imported = await provider.import(normalizedUrl);
    if (imported.project.status !== 'active') {
      throw new BadRequestException('現在公開中・募集中のプロジェクトだけ取り込めます。終了済み・公開前のURLは対象外です。');
    }
    const userId = options.userId ?? (await this.projectImportRepository.resolveActorUserId(options.actor));
    const result = await this.projectImportRepository.persistImportedProject(imported, { ...options, userId });

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
  actor?: ProjectActor;
  userId?: string | null;
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
