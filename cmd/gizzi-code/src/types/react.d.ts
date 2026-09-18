// Repo-local React type AUGMENTATION — NOT a replacement for @types/react.
//
// The real React 19 types come from `@types/react` (declared in package.json).
// This file must never redeclare the 'react' module: doing so shadows the real
// types (see burn-down batches b0002/b0003 — the old permissive shadow here
// omitted RefObject, useDeferredValue, and the 3-argument useReducer overload,
// forcing hand-mirrored TODO(types) shims in ink-app files).
//
// What belongs here: shapes the real types genuinely lack.
export {}

declare module 'react/compiler-runtime' {
  // The react package ships compiler-runtime.js without bundled types and
  // @types/react does not declare this subpath. The real signature returns a
  // cache-slot reader; kept intentionally loose, same as the previous stub.
  export function c(cacheSize: number): (slot: number) => any
}
