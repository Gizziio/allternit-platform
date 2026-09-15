// @ts-nocheck
/**
 * Holds beta memoization caches so they can be cleared without creating an
 * import cycle between auth.ts and betas.ts.
 */

type MemoizedFunction = { cache?: { clear?: () => void } }

const caches = new Set<MemoizedFunction>()

export function registerBetasCache(fn: MemoizedFunction): void {
  caches.add(fn)
}

export function clearBetasCaches(): void {
  for (const fn of caches) {
    fn.cache?.clear?.()
  }
}
