jest.mock('playwright', () => ({ chromium: { launch: jest.fn() } }));

import { chromium } from 'playwright';
import { MakuakeProjectSourceProvider } from './makuake-project-source.provider';

describe('Makuake search cancellation', () => {
  it('closes context then browser once and opens no queued page after abort', async () => {
    const events: string[] = [];
    const pendingRejects: Array<(error: Error) => void> = [];
    const page = {
      goto: jest.fn(() => new Promise<never>((_, reject) => pendingRejects.push(reject))),
      close: jest.fn().mockResolvedValue(undefined)
    };
    const context = {
      newPage: jest.fn().mockResolvedValue(page),
      close: jest.fn().mockImplementation(async () => {
        events.push('context');
        pendingRejects.splice(0).forEach((reject) => reject(new Error('context closed')));
      })
    };
    const browser = {
      newContext: jest.fn().mockResolvedValue(context),
      close: jest.fn().mockImplementation(async () => {
        events.push('browser');
      })
    };
    (chromium.launch as jest.Mock).mockResolvedValue(browser);
    const provider = new MakuakeProjectSourceProvider();
    const controller = new AbortController();

    const search = provider.search({ keyword: '食品', limit: 10 }, { signal: controller.signal });
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();

    await expect(withTimeout(search, 2000)).rejects.toMatchObject({ name: 'AbortError' });
    expect(context.newPage).toHaveBeenCalledTimes(3);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['context', 'browser']);
  });
});

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('cancellation timeout')), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
