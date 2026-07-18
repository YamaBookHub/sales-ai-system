export type LeadListPage<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
};

export type LeadExportFormat = 'csv' | 'tsv';

type LeadPageFetchOptions = {
  pageSize?: number;
  concurrency?: number;
};

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_CONCURRENCY = 4;
const MAX_PAGE_SIZE = 100;
const MAX_CONCURRENCY = 4;

export async function collectAllLeadPages<T>(
  fetchPage: (page: number, limit: number) => Promise<LeadListPage<T>>,
  options: LeadPageFetchOptions = {}
): Promise<T[]> {
  const clampOption = (value: unknown, fallback: number, maximum: number): number => {
    const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
    return Math.min(maximum, Math.max(1, numeric));
  };
  const pageSize = clampOption(options.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const concurrency = clampOption(options.concurrency, DEFAULT_CONCURRENCY, MAX_CONCURRENCY);
  const firstPage = await fetchPage(1, pageSize);
  const firstLimit = clampOption(firstPage.limit, pageSize, MAX_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, firstPage.total) / firstLimit));

  if (totalPages === 1) return firstPage.items.slice();

  const pages: Array<LeadListPage<T> | undefined> = new Array(totalPages);
  pages[0] = firstPage;
  let nextPage = 2;

  async function worker(): Promise<void> {
    while (true) {
      const page = nextPage;
      nextPage += 1;
      if (page > totalPages) return;
      pages[page - 1] = await fetchPage(page, pageSize);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, totalPages - 1) }, () => worker()));
  return pages.flatMap((page) => page?.items || []);
}

export function serializeLeadExportRows(rows: unknown[][], format: LeadExportFormat): string {
  const records = rows.map((row) => row.map((value) => {
    const text = String(value ?? '');
    if (format === 'tsv') return text.replace(/[\t\r\n]/g, ' ');
    return '"' + text.replace(/"/g, '""') + '"';
  }).join(format === 'tsv' ? '\t' : ','));
  const content = records.join('\r\n');
  return format === 'csv' ? '\uFEFF' + content : content;
}

export function renderClientLeadExportScript(): string {
  return [
    '(function (global) {',
    `  const DEFAULT_PAGE_SIZE = ${DEFAULT_PAGE_SIZE};`,
    `  const DEFAULT_CONCURRENCY = ${DEFAULT_CONCURRENCY};`,
    `  const MAX_PAGE_SIZE = ${MAX_PAGE_SIZE};`,
    `  const MAX_CONCURRENCY = ${MAX_CONCURRENCY};`,
    `  const collectAllLeadPages = ${collectAllLeadPages.toString()};`,
    `  const serializeLeadExportRows = ${serializeLeadExportRows.toString()};`,
    '  global.SalesAiLeadExport = { collectAllLeadPages, serializeLeadExportRows };',
    '})(window);'
  ].join('\n');
}
