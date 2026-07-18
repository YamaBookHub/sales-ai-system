jest.mock('playwright', () => ({ chromium: { launch: jest.fn() } }));

import { chromium } from 'playwright';
import { MakuakeProjectSourceProvider } from './makuake-project-source.provider';

describe('Makuake progressive search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports detail-enriched candidates in stable batches before returning', async () => {
    mockBrowser(listingHtml(5), detailText(50));
    const onItems = jest.fn().mockResolvedValue(true);
    const provider = new MakuakeProjectSourceProvider();

    const result = await provider.search({ limit: 10, amountMax: 100 }, { onItems });

    expect(result.items).toHaveLength(5);
    expect(onItems.mock.calls.map(([items]) => items.length)).toEqual([4, 5]);
    expect(onItems.mock.calls[0][0].map((item: { url: string }) => item.url)).toEqual(
      Array.from({ length: 4 }, (_, index) => `https://www.makuake.com/project/progressive-${index}/`)
    );
  });

  it('never exposes a listing candidate that fails filters after detail enrichment', async () => {
    mockBrowser(listingHtml(1), detailText(5_000));
    const onItems = jest.fn().mockResolvedValue(true);
    const provider = new MakuakeProjectSourceProvider();

    const result = await provider.search({ limit: 10, amountMax: 100 }, { onItems });

    expect(result.items).toEqual([]);
    expect(onItems).toHaveBeenCalledTimes(1);
    expect(onItems).toHaveBeenCalledWith([]);
  });
});

function mockBrowser(listing: string, visibleText: string) {
  const pageFactory = (detailPage: boolean) => {
    return {
      goto: jest.fn().mockResolvedValue(undefined),
      content: jest.fn().mockResolvedValue(listing),
      evaluate: jest.fn().mockImplementation(async () => detailPage ? visibleText : undefined),
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    };
  };
  let pageCount = 0;
  const context = {
    newPage: jest.fn().mockImplementation(async () => pageFactory(pageCount++ >= 3)),
    close: jest.fn().mockResolvedValue(undefined)
  };
  const browser = {
    newContext: jest.fn().mockResolvedValue(context),
    close: jest.fn().mockResolvedValue(undefined)
  };
  (chromium.launch as jest.Mock).mockResolvedValue(browser);
}

function listingHtml(count: number) {
  return `<!doctype html><html lang="ja"><body>${Array.from(
    { length: count },
    (_, index) => `
      <article>
        <a href="/project/progressive-${index}/" title="逐次候補${index}">
          <h2>逐次候補${index}</h2>
          <p>サポーター 10人</p>
          <p>残り8日</p>
          <p>カテゴリ プロダクト</p>
          <p>地域 東京</p>
        </a>
      </article>`
  ).join('')}</body></html>`;
}

function detailText(amount: number) {
  return `¥${amount.toLocaleString()} サポーター 10人 残り8日 販売中 カテゴリ プロダクト 地域 東京`;
}
