// @ts-nocheck
// Shim for React 19's `react/compiler-runtime` subpath (absent in this repo's
// React 18). React-Compiler-compiled components call `c(size)` to allocate a
// memo cache. This shim returns a cache that always reports a miss, so those
// components simply recompute — semantically identical, marginally slower.

const MISS = Symbol.for('react.compiler_cache_miss')

export function c(size: number): unknown[] {
  const slots: unknown[] = new Array(size).fill(MISS)
  return new Proxy(slots, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        const v = Reflect.get(target, prop, receiver)
        return v === undefined ? MISS : v
      }
      return Reflect.get(target, prop, receiver)
    },
  })
}

export default { c }
