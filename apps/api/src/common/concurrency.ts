export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: safeConcurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      const current = items[index];
      cursor += 1;
      results[index] = await worker(current, index);
    }
  });
  await Promise.all(workers);
  return results;
}
