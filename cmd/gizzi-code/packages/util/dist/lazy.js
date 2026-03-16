/**
 * @a2r/util/lazy — lazy initialization
 * lazy(fn) returns a function that calls fn() on first invocation and caches the result.
 */
export function lazy(fn) {
  let cache
  let called = false
  return async function () {
    if (!called) {
      called = true
      cache = await fn()
    }
    return cache
  }
}
