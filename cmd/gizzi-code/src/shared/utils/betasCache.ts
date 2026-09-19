/**
 * Holds beta memoization caches so they can be cleared without creating an
 * import cycle between auth.ts and betas.ts.
 */

type MemoizedFunction = { cache?: { clear?: () => void } }

const caches = new Set<MemoizedFunction>()

/**
 * Registers a memoized betas getter for global cache clearing and returns it.
 * Callers assign the result directly to their exported const — a void return
 * made those exports undefined at runtime (latent bug since e3c7fa284).
 * Intersection (rather than a T extends constraint) because the lodash-es
 * memoize subpath typings return the bare function type without the cache
 * shape, which would collapse the inference to the constraint.
 */
export function registerBetasCache<F>(fn: F & MemoizedFunction): F & MemoizedFunction {
  caches.add(fn)
  return fn
}

export function clearBetasCaches(): void {
  for (const fn of caches) {
    fn.cache?.clear?.()
  }
}
