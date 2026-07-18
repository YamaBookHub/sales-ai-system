import {
  collectAllLeadPages,
  renderClientLeadExportScript,
  serializeLeadExportRows
} from './lead-export';

describe('lead export client helpers', () => {
  it('collects a 201-record fixture exactly once in server page order', async () => {
    const records = Array.from({ length: 201 }, (_, index) => `lead-${index + 1}`);
    const requestedPages: number[] = [];
    const result = await collectAllLeadPages(async (page, limit) => {
      requestedPages.push(page);
      const start = (page - 1) * limit;
      return {
        items: records.slice(start, start + limit),
        page,
        limit,
        total: records.length
      };
    });

    expect(result).toEqual(records);
    expect(new Set(result).size).toBe(201);
    expect(requestedPages).toContain(1);
    expect(requestedPages).toHaveLength(3);
  });

  it('preserves page order when later pages resolve first', async () => {
    const delays = new Map([[2, 35], [3, 5], [4, 20]]);
    const result = await collectAllLeadPages(async (page, limit) => {
      await new Promise((resolve) => setTimeout(resolve, delays.get(page) || 0));
      return {
        items: [`page-${page}-a`, `page-${page}-b`],
        page,
        limit,
        total: 8
      };
    }, { pageSize: 2, concurrency: 3 });

    expect(result).toEqual([
      'page-1-a', 'page-1-b',
      'page-2-a', 'page-2-b',
      'page-3-a', 'page-3-b',
      'page-4-a', 'page-4-b'
    ]);
  });

  it('bounds concurrent page requests and clamps invalid options', async () => {
    let active = 0;
    let maxActive = 0;
    const result = await collectAllLeadPages(async (page, limit) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return { items: [page], page, limit, total: 201 };
    }, { pageSize: 1, concurrency: 999 });

    expect(result).toHaveLength(201);
    expect(maxActive).toBeLessThanOrEqual(4);
  });

  it('serializes CSV with BOM, quoted fields, escaped quotes, and newlines', () => {
    expect(serializeLeadExportRows([
      ['会社', '案件名', '備考'],
      ['A社', '行1\n行2', 'He said "yes"']
    ], 'csv')).toBe('\uFEFF"会社","案件名","備考"\r\n"A社","行1\n行2","He said ""yes"""');
  });

  it('serializes TSV without BOM and protects row and column structure', () => {
    expect(serializeLeadExportRows([
      ['会社', '案件名', '備考'],
      ['A社', '行1\n行2\t続き', 'He said "yes"']
    ], 'tsv')).toBe('会社\t案件名\t備考\r\nA社\t行1 行2 続き\tHe said "yes"');
  });

  it('renders a browser-parseable global helper', async () => {
    const script = renderClientLeadExportScript();
    const fakeWindow: Record<string, unknown> = {};
    const exported = new Function('window', script + '; return window.SalesAiLeadExport;')(fakeWindow) as {
      collectAllLeadPages: typeof collectAllLeadPages;
      serializeLeadExportRows: typeof serializeLeadExportRows;
    };

    expect(() => new Function('window', script)).not.toThrow();
    expect(exported.serializeLeadExportRows([['a', 'b']], 'tsv')).toBe('a\tb');
    await expect(exported.collectAllLeadPages(async (page, limit) => ({
      items: [page],
      page,
      limit,
      total: 1
    }))).resolves.toEqual([1]);
  });
});
