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
