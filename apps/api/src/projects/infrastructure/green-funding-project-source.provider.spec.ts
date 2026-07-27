import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OperationAbortedError } from '../../common/abortable-resource';
import { GreenFundingProjectSourceProvider } from './green-funding-project-source.provider';

const fixture = (name: string) => readFileSync(
  join(__dirname, 'parsers', 'green-funding', '__fixtures__', name),
  'utf8'
);

describe('GreenFundingProjectSourceProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('searches active listings and applies ending-soon conditions', async () => {
    const listing = fixture('listing-active.html').replace(
      /<nav class="pagination">[\s\S]*?<\/nav>/,
      ''
    );
    global.fetch = jest.fn(async () => new Response(listing, { status: 200 })) as typeof fetch;

    const provider = new GreenFundingProjectSourceProvider();
    const result = await provider.search({ limit: 10, status: 'endingSoon', endingSoonDays: 7 });

    expect(result.items).toEqual([
      expect.objectContaining({
        url: 'https://greenfunding.jp/lab/projects/9380',
        amount: 41896477,
        supporterCount: 680,
        daysLeft: 4
      })
    ]);
  });

  it('normalizes a detail page into the common imported-project contract', async () => {
    global.fetch = jest.fn(async () => new Response(fixture('detail-active.html'), { status: 200 })) as typeof fetch;

    const provider = new GreenFundingProjectSourceProvider();
    const result = await provider.import('https://www.greenfunding.jp/lab/projects/9380/activities?tracking=1');

    expect(result).toMatchObject({
      source: 'green_funding',
      company: {
        name: '株式会社SPACE',
        websiteUrl: 'https://space.example/',
        inquiryUrl: 'https://greenfunding.jp/lab/projects/9380/project_inquiries/faq'
      },
      project: {
        title: '家庭で本格ラテを楽しめるマシン',
        url: 'https://greenfunding.jp/lab/projects/9380',
        status: 'active',
        amount: 41896477,
        supporterCount: 680,
        daysLeft: 4,
        category: 'ライフスタイル'
      },
      lead: {
        source: 'green_funding_import'
      }
    });
  });

  it('does not combine the keyword query with condition=new and excludes ended cards', async () => {
    const fetchSpy = jest.fn(async (_input: string | URL | Request) => (
      new Response(fixture('listing-ended.html'), { status: 200 })
    ));
    global.fetch = fetchSpy as typeof fetch;

    const result = await new GreenFundingProjectSourceProvider().search({
      keyword: '終了案件',
      limit: 10
    });

    expect(result.items).toEqual([]);
    const requestedUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain('q%5Btitle_or_planner_name_cont%5D=');
    expect(requestedUrl).not.toContain('condition=new');
  });

  it('keeps official search results when the keyword matched the executor name', async () => {
    const listing = fixture('listing-active.html').replace(
      /<nav class="pagination">[\s\S]*?<\/nav>/,
      ''
    );
    global.fetch = jest.fn(async () => new Response(listing, { status: 200 })) as typeof fetch;

    const result = await new GreenFundingProjectSourceProvider().search({
      keyword: '株式会社SPACE',
      limit: 10
    });

    expect(result.items).toEqual([
      expect.objectContaining({ url: 'https://greenfunding.jp/lab/projects/9380' })
    ]);
  });

  it('maps sub-day listing values to zero remaining days', async () => {
    global.fetch = jest.fn(async () => (
      new Response(fixture('listing-subday.html'), { status: 200 })
    )) as typeof fetch;

    const result = await new GreenFundingProjectSourceProvider().search({
      limit: 10,
      status: 'endingSoon',
      endingSoonDays: 7
    });

    expect(result.items.map((item) => item.daysLeft)).toEqual([0, 0]);
  });

  it('continues through page 24 when strict conditions have not reached the requested limit', async () => {
    const activeListing = fixture('listing-active.html').replace(
      /<nav class="pagination">[\s\S]*?<\/nav>/,
      ''
    );
    const lowAmountListing = fixture('listing-active.html').replace(
      '¥41,896,477',
      '¥1,000'
    );
    const fetchSpy = jest.fn(async (input: string | URL | Request) => {
      const page = Number(new URL(String(input)).searchParams.get('page') || '1');
      const html = page === 24
        ? activeListing
        : lowAmountListing.replaceAll('9380', String(9000 + page));
      return new Response(html, { status: 200 });
    });
    global.fetch = fetchSpy as typeof fetch;

    const result = await new GreenFundingProjectSourceProvider().search({
      limit: 10,
      amountMin: 40_000_000
    });

    expect(result.items).toEqual([
      expect.objectContaining({ url: 'https://greenfunding.jp/lab/projects/9380' })
    ]);
    expect(fetchSpy.mock.calls.some(([input]) => (
      new URL(String(input)).searchParams.get('page') === '24'
    ))).toBe(true);
  });

  it('keeps an explicitly available detail active when remaining days are unavailable', async () => {
    const detailWithoutDays = fixture('detail-active.html')
      .replace('<meta property="product:custom_label_0" content="4日">', '')
      .replace(
        '<div class="project_sidebar_dashboard-info-number"><span class="is-number">4</span><span>日</span></div>',
        ''
      );
    global.fetch = jest.fn(async () => (
      new Response(detailWithoutDays, { status: 200 })
    )) as typeof fetch;

    const result = await new GreenFundingProjectSourceProvider().import(
      'https://greenfunding.jp/lab/projects/9380'
    );

    expect(result.project).toMatchObject({ status: 'active', daysLeft: null });
  });

  it('honors a cancellation request before network access', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as typeof fetch;
    const controller = new AbortController();
    controller.abort();

    await expect(
      new GreenFundingProjectSourceProvider().search({ limit: 10 }, { signal: controller.signal })
    ).rejects.toBeInstanceOf(OperationAbortedError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
