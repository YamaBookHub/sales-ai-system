import { BadRequestException } from '@nestjs/common';
import { ProjectSourceCapabilities, ProjectSourceProvider } from './project-source-provider';
import { ProjectSourceRegistry } from './project-source-registry';
import { ProjectSource } from '../projects.dto';

describe('ProjectSourceRegistry', () => {
  const campfireCapabilities = {
    keywordSearch: true,
    categoryFilter: true,
    endingSoonFilter: true,
    amountFilter: true,
    supporterFilter: true,
    profileProjectCountFilter: true,
    progressiveResults: true,
    cancellation: true
  } as const;
  const makuakeCapabilities = {
    keywordSearch: true,
    categoryFilter: false,
    endingSoonFilter: true,
    amountFilter: true,
    supporterFilter: true,
    profileProjectCountFilter: false,
    progressiveResults: true,
    cancellation: true
  } as const;
  const greenFundingCapabilities = {
    keywordSearch: true,
    categoryFilter: true,
    endingSoonFilter: true,
    amountFilter: true,
    supporterFilter: true,
    profileProjectCountFilter: false,
    progressiveResults: true,
    cancellation: true
  } as const;

  const campfireProvider = createProvider('campfire', 'CAMPFIRE', 'https://camp-fire.jp', campfireCapabilities);
  const makuakeProvider = createProvider('makuake', 'Makuake', 'https://www.makuake.com', makuakeCapabilities);
  const greenFundingProvider = createProvider(
    'green_funding',
    'GREEN FUNDING',
    'https://greenfunding.jp',
    greenFundingCapabilities
  );

  const createRegistry = () => new ProjectSourceRegistry([
    campfireProvider,
    makuakeProvider,
    greenFundingProvider
  ]);

  it('resolves all registered source providers', () => {
    const registry = createRegistry();

    expect(registry.get('campfire')).toBe(campfireProvider);
    expect(registry.get('makuake')).toBe(makuakeProvider);
    expect(registry.get('green_funding')).toBe(greenFundingProvider);
  });

  it('normalizes source name case and hyphens before resolving', () => {
    const registry = createRegistry();

    expect(registry.get('CAMP-FIRE')).toBe(campfireProvider);
    expect(registry.get('MaKu-AkE')).toBe(makuakeProvider);
    expect(registry.get('GREEN-FUNDING')).toBe(greenFundingProvider);
  });

  it('defaults an absent source to CAMPFIRE', () => {
    expect(createRegistry().get()).toBe(campfireProvider);
  });

  it('lists provider descriptors and capabilities in registration order', () => {
    expect(createRegistry().list()).toEqual([
      {
        source: 'campfire',
        name: 'CAMPFIRE',
        baseUrl: 'https://camp-fire.jp',
        capabilities: campfireCapabilities
      },
      {
        source: 'makuake',
        name: 'Makuake',
        baseUrl: 'https://www.makuake.com',
        capabilities: makuakeCapabilities
      },
      {
        source: 'green_funding',
        name: 'GREEN FUNDING',
        baseUrl: 'https://greenfunding.jp',
        capabilities: greenFundingCapabilities
      }
    ]);
  });

  it('rejects unknown or unregistered sources', () => {
    const registry = createRegistry();

    expect(() => registry.get('not-a-source')).toThrow(BadRequestException);
  });

  it('rejects duplicate source registrations at construction', () => {
    const duplicateCampfireProvider = createProvider(
      'campfire',
      'CAMPFIRE duplicate',
      'https://duplicate.example',
      campfireCapabilities
    );

    expect(() => new ProjectSourceRegistry([campfireProvider, duplicateCampfireProvider])).toThrow();
  });
});

function createProvider(
  source: ProjectSource,
  name: string,
  baseUrl: string,
  capabilities: ProjectSourceCapabilities
): ProjectSourceProvider {
  return {
    source,
    name,
    baseUrl,
    capabilities,
    async categories() {
      return { items: [] };
    },
    async search() {
      return { items: [] };
    },
    async import() {
      throw new Error('Provider import is not used by registry contract tests');
    },
    normalizeUrl(url: string) {
      return url.trim();
    }
  };
}
