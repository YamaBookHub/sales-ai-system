import { Injectable } from '@nestjs/common';
import { CampfireScraperService, ScrapedCampfireProject } from '../scraper/campfire-scraper.service';
import { SearchCampfireProjectsDto } from './projects.dto';
import { NormalizedImportedProject, ProjectSourceProvider } from './project-source-provider';

@Injectable()
export class CampfireProjectSourceProvider implements ProjectSourceProvider {
  readonly source = 'campfire' as const;
  readonly name = 'CAMPFIRE';
  readonly baseUrl = 'https://camp-fire.jp';

  constructor(private readonly scraper: CampfireScraperService) {}

  categories() {
    return this.scraper.categories();
  }

  search(input: SearchCampfireProjectsDto) {
    return this.scraper.search(input);
  }

  async import(url: string): Promise<NormalizedImportedProject> {
    const scraped = await this.scraper.scrape(this.normalizeUrl(url));
    const companyName = scraped.brandName || scraped.executorName || 'CAMPFIRE実行者名未取得';

    return {
      source: this.source,
      platform: {
        type: 'campfire',
        name: this.name,
        baseUrl: this.baseUrl
      },
      company: {
        name: companyName,
        websiteUrl: scraped.websiteUrl || undefined,
        inquiryUrl: scraped.inquiryUrl || undefined,
        sourceProjectCount: scraped.profileProjectCount,
        memo: scraped.executorName ? `CAMPFIRE executor: ${scraped.executorName}` : undefined
      },
      project: {
        title: scraped.projectTitle,
        url: scraped.projectUrl,
        status: 'active',
        amount: parseInteger(scraped.supportAmount),
        supporterCount: parseInteger(scraped.supporters),
        daysLeft: parseInteger(scraped.daysLeft),
        description: scraped.mainDescription || undefined,
        category: scraped.category || cleanScrapedFeature(scraped.features[0]) || undefined,
        scrapedAt: new Date()
      },
      lead: {
        source: 'campfire_import',
        reason: buildImportReason(scraped),
        contactFormUrl: scraped.inquiryUrl || undefined,
        brandWebsiteUrl: scraped.websiteUrl || undefined,
        instagramUrl: scraped.instagramUrl || undefined,
        tiktokUrl: scraped.tiktokUrl || undefined,
        xUrl: scraped.xUrl || undefined,
        contactMemo: buildAutoUrlMemo(scraped),
        brandAnalysisMemo: buildLargeProfileWarning(scraped)
      },
      raw: {
        projectId: scraped.projectId,
        projectTitle: scraped.projectTitle,
        executorName: scraped.executorName,
        brandName: scraped.brandName,
        supportAmount: scraped.supportAmount,
        supporters: scraped.supporters,
        achievementRate: scraped.achievementRate,
        daysLeft: scraped.daysLeft,
        features: scraped.features,
        profileUrl: scraped.profileUrl,
        profileProjectCount: scraped.profileProjectCount,
        websiteUrl: scraped.websiteUrl,
        inquiryUrl: scraped.inquiryUrl,
        instagramUrl: scraped.instagramUrl,
        tiktokUrl: scraped.tiktokUrl,
        xUrl: scraped.xUrl,
        externalUrls: scraped.externalUrls
      }
    };
  }

  normalizeUrl(url: string) {
    return url.trim();
  }
}

function parseInteger(value: string) {
  const number = Number((value || '').replace(/[^0-9]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function buildImportReason(scraped: Pick<ScrapedCampfireProject, 'achievementRate' | 'daysLeft' | 'features'>) {
  const feature = cleanScrapedFeature(scraped.features[0]);
  const values = [scraped.achievementRate && `達成率: ${scraped.achievementRate}`, scraped.daysLeft && `残り日数: ${scraped.daysLeft}`, feature && `特徴: ${feature}`].filter(Boolean);
  return values.join(' / ') || 'CAMPFIRE import';
}

function cleanScrapedFeature(value?: string) {
  const cleaned = (value || '').trim();
  if (!cleaned || cleaned === 'カテゴリーからさがす' || cleaned === 'カテゴリからさがす') return '';
  return cleaned;
}

function buildAutoUrlMemo(scraped: Pick<ScrapedCampfireProject, 'externalUrls'>) {
  const notes = [];
  if (scraped.externalUrls.length) {
    notes.push(`CAMPFIREページから自動取得したURL: ${scraped.externalUrls.slice(0, 8).join(' / ')}`);
  }
  return notes.join('\n') || undefined;
}

function buildLargeProfileWarning(scraped: Pick<ScrapedCampfireProject, 'profileProjectCount'>) {
  if (scraped.profileProjectCount === null || scraped.profileProjectCount < 100) return undefined;
  return `注意: この実行者は過去プロジェクトが${scraped.profileProjectCount}件以上ある可能性があります。過去案件の詳細スクレイピングは重くなるため、必要な場合だけ手動確認してください。`;
}
