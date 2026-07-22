// @ts-nocheck
/**
 * react-compiler runtime compatible with the compiler output in this repo.
 *
 * The compiled components in src/ were produced by a react-compiler version
 * whose cache-miss guard is `Symbol.for("react.memo_cache_sentinel")`. React
 * 19.2's built-in `react/compiler-runtime` instead fills the memo cache with
 * `Symbol.for("react.compiler_cache_miss")`, so every first-render guard in
 * the compiled output silently misses and yields the sentinel itself
 * (observed as `useMailbox()` returning a Symbol).
 *
 * This module implements the `c` hook with the sentinel contract the compiled
 * output expects: a per-component-instance array, stable across renders,
 * pre-filled with `react.memo_cache_sentinel`.
 */
import { useState } from 'react'

const MEMO_CACHE_SENTINEL = Symbol.for('react.memo_cache_sentinel')

function makeCache(size: number): unknown[] {
  const cache = new Array(size)
  for (let i = 0; i < size; i++) {
    cache[i] = MEMO_CACHE_SENTINEL
  }
  return cache
}

/** Memo cache hook consumed by react-compiler output (`_c`). */
export function c(size: number): unknown[] {
  const [cache] = useState(() => makeCache(size))
  return cache
}

export const useMemoCache = c
