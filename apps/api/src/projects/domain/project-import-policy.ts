export function clampConcurrency(value: number | undefined, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

export function normalizeResultLimit(value?: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 10;
  return Math.max(10, Math.min(200, Math.floor(number)));
}

export function normalizeEndingSoonDays(value?: number) {
  const number = Number(value);
  return [7, 14, 20, 30].includes(number) ? number : 14;
}

export function sortEndingSoon<T extends { daysLeft?: number | null; isActive?: boolean }>(items: T[], maxDays = 14) {
  return [...items]
    .filter((item) => item.isActive !== false && typeof item.daysLeft === 'number' && item.daysLeft <= maxDays)
    .sort((a, b) => Number(a.daysLeft) - Number(b.daysLeft));
}

export function progressiveSearchLimits(desiredLimit: number) {
  const normalizedDesiredLimit = normalizeResultLimit(desiredLimit);
  const firstLimit = normalizedDesiredLimit <= 10 ? 10 : normalizedDesiredLimit;
  return [10, 50, 100, 150, 200].filter((limit) => limit >= firstLimit);
}

export function mergeSearchItems<T extends { url: string }>(current: T[], next: T[]) {
  const map = new Map(current.map((item) => [normalizeSearchUrl(item.url), item]));
  next.forEach((item) => map.set(normalizeSearchUrl(item.url), item));
  return Array.from(map.values());
}

export function countImportableSearchItems<T extends { url: string }>(items: T[], existingUrls: Set<string>) {
  return items.filter((item) => !existingUrls.has(normalizeSearchUrl(item.url))).length;
}

export function normalizeSearchUrl(value: string) {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return String(value).split('#')[0].split('?')[0].replace(/\/$/, '');
  }
}

export function uniqueNormalizedUrlInputs(urls: string[] | undefined, normalizeUrl: (value: string) => string) {
  return Array.from(
    new Map(
      (urls || [])
        .map((originalUrl) => ({
          originalUrl,
          url: normalizeUrl(originalUrl)
        }))
        .filter((item) => item.url)
        .map((item) => [item.url, item])
    ).values()
  );
}

export type BulkImportItemResult = {
  originalUrl: string;
  url: string;
  status: 'imported' | 'failed';
  leadId?: string;
  message?: string;
};

export type BulkImportAnalysisResult = {
  leadId: string;
  status: 'analyzed' | 'failed';
  message?: string;
};

export function buildBulkImportSummary(input: {
  source: string;
  total: number;
  items: BulkImportItemResult[];
  analysisItems: BulkImportAnalysisResult[];
}) {
  return {
    source: input.source,
    total: input.total,
    imported: input.items.filter((item) => item.status === 'imported').length,
    failed: input.items.filter((item) => item.status === 'failed').length,
    analyzed: input.analysisItems.filter((item) => item.status === 'analyzed').length,
    analysisFailed: input.analysisItems.filter((item) => item.status === 'failed').length,
    items: input.items,
    analysisItems: input.analysisItems
  };
}
