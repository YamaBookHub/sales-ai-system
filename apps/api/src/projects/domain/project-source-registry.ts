import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { ProjectSourceDescriptor, ProjectSourceProvider } from './project-source-provider';

export const PROJECT_SOURCE_PROVIDERS = Symbol('PROJECT_SOURCE_PROVIDERS');

@Injectable()
export class ProjectSourceRegistry {
  private readonly providers = new Map<string, ProjectSourceProvider>();

  constructor(
    @Inject(PROJECT_SOURCE_PROVIDERS)
    providers: ProjectSourceProvider[]
  ) {
    for (const provider of providers) {
      const key = normalizeProjectSourceId(provider.source);
      if (this.providers.has(key)) {
        throw new Error(`取得元が重複登録されています: ${provider.source}`);
      }
      this.providers.set(key, provider);
    }
  }

  get(source?: string): ProjectSourceProvider {
    const normalized = normalizeProjectSourceId(source || 'campfire');
    const provider = this.providers.get(normalized);
    if (provider) return provider;

    const available = this.list().map((item) => item.name).join('、');
    throw new BadRequestException(
      `${source || '未指定'}は未登録の取得元です。現在利用できる取得元: ${available || 'なし'}`
    );
  }

  list(): ProjectSourceDescriptor[] {
    return Array.from(this.providers.values(), (provider) => ({
      source: provider.source,
      name: provider.name,
      baseUrl: provider.baseUrl,
      capabilities: provider.capabilities
    }));
  }
}

export function normalizeProjectSourceId(source: string): string {
  return source.trim().toLowerCase().replace(/[-_\s]/g, '');
}
