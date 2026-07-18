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

export type ProjectSearchDiagnostics = {
  sourceCandidateCount: number;
  conditionMatchedCount: number;
  excludedCount: number;
  scanComplete: boolean;
};

export type ProjectSourceSearchResult = {
  items: ProjectSearchResult[];
  diagnostics?: ProjectSearchDiagnostics;
};

export type ProjectSearchItemListener = (items: ProjectSearchResult[]) => boolean | void | Promise<boolean | void>;

export type ProjectSearchOptions = {
  signal?: AbortSignal;
  /**
   * Reports candidates as they are observed. Returning false asks the provider
   * to stop emitting because the owning search job is no longer active.
   */
  onItems?: ProjectSearchItemListener;
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
  search(input: SearchCampfireProjectsDto, options?: ProjectSearchOptions): Promise<ProjectSourceSearchResult>;
  import(url: string): Promise<NormalizedImportedProject>;
  normalizeUrl(url: string): string;
};
