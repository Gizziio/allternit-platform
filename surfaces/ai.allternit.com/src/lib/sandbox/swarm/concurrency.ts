/**
 * Bounded-concurrency fan-out helper shared by SwarmProvider implementations.
 * Runs `fn` over `items` with at most `limit` calls in flight at once —
 * never a serial loop, never an unbounded `Promise.all`.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        const value = await fn(items[index], index);
        results[index] = { status: "fulfilled", value };
      } catch (error) {
        results[index] = {
          status: "rejected",
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
