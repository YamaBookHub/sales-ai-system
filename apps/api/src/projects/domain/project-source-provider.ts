import { ProjectSource, SearchCampfireProjectsDto } from '../projects.dto';

export type ProjectSourceCategory = {
  label: string;
  value: string;
};

export type ProjectSearchResult = {
  title: string;
  url: string;
  summary?: string;
  amount?: number | null;
  supporterCount?: number | null;
  daysLeft?: number | null;
  profileProjectCount?: number | null;
  category?: string | null;
};

export type NormalizedImportedProject = {
  source: ProjectSource;
  platform: {
    type: 'campfire' | 'makuake' | 'green_funding' | 'other';
    name: string;
    baseUrl: string;
  };
  company: {
    name: string;
    websiteUrl?: string;
    inquiryUrl?: string;
    location?: string;
    sourceTotalAmount?: number | null;
    sourceProjectCount?: number | null;
    sourceSupporterCount?: number | null;
    memo?: string;
  };
  project: {
    title: string;
    url: string;
    status: 'active' | 'ended' | 'unknown';
    amount: number;
    supporterCount: number;
    daysLeft?: number | null;
    description?: string;
    category?: string;
    location?: string;
    thumbnailUrl?: string;
    scrapedAt: Date;
  };
  lead: {
    source: string;
    reason: string;
    contactFormUrl?: string;
    brandWebsiteUrl?: string;
    instagramUrl?: string;
    tiktokUrl?: string;
    xUrl?: string;
    contactMemo?: string;
    brandAnalysisMemo?: string;
  };
  raw: Record<string, unknown>;
};

export type ProjectSourceProvider = {
  readonly source: ProjectSource;
  readonly name: string;
  readonly baseUrl: string;
  categories(): Promise<{ items: ProjectSourceCategory[] }>;
  search(input: SearchCampfireProjectsDto): Promise<{ items: ProjectSearchResult[] }>;
  import(url: string): Promise<NormalizedImportedProject>;
  normalizeUrl(url: string): string;
};
