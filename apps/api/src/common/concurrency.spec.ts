import { runWithConcurrency } from './concurrency';

describe('runWithConcurrency', () => {
  it('preserves result order while limiting concurrent workers', async () => {
    let active = 0;
    let maxActive = 0;
    const results = await runWithConcurrency([1, 2, 3, 4], 2, async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, item === 1 ? 5 : 1));
      active -= 1;
      return item * 10;
    });

    expect(results).toEqual([10, 20, 30, 40]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('handles empty input', async () => {
    await expect(runWithConcurrency([], 3, async (item) => item)).resolves.toEqual([]);
  });
});
