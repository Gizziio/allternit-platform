# Session ao/useeffect-fixes (Kimi Code) — FuzzyPicker stale-closure fix

**Date:** 2026-09-18 · **Branch:** ao/useeffect-fixes · **PR:** #577 · **Merged:** a6bb33440 (main)

## What was done

Fixed two confirmed `useEffect` stale-closure bugs in the Ink TUI design-system
picker, as part of a cross-repo useEffect audit (repo 1 = Gizziio/allternit-ai,
this repo = repo 2):

- `cmd/gizzi-code/src/cli/ui/ink-app/components/design-system/FuzzyPicker.tsx`
  - The `[query]` effect called `onQueryChange(query)` and the `[focused]`
    effect called `onFocus?.(focused)` using callbacks captured at first
    render — both callbacks were deliberately omitted from the deps arrays
    (with `eslint-disable-next-line react-hooks/exhaustive-deps`), so a caller
    passing a new callback kept getting the old one.
  - Fix: mirror both callbacks into refs (`onQueryChangeRef` / `onFocusRef`)
    updated every render (deps-less effect), and call through the refs inside
    the existing effects. This is the house ref-mirror pattern
    (cf. `src/cli/ui/ink-app/hooks/useAwaySummary.ts` `messagesRef`).
  - Removed the two now-unneeded exhaustive-deps disable comments.
- `.steering/checkpoint.md` — session checkpoint.

**Surprise worth recording:** `FuzzyPicker.tsx` (like ~360 of 361 files under
`src/cli/ui/ink-app`) is a checked-in React Compiler artifact
(`@ts-nocheck` + `import { c as _c } from "react/compiler-runtime"`). There is
no separate source copy — the whole ink-app tree IS the source as committed
(last tree-wide touch: "ci: build script is build-production.js, not .ts";
production builds stub `react/compiler-runtime` via a no-op). The fix was
hand-applied to that canonical copy in its existing style. A repo-wide lint
rollout for these artifacts was explicitly out of scope.

## How it works

Refs always hold the latest callback; the `[query]`/`[focused]` effects keep
their intentional narrow deps (query string, focused item identity) so they
don't re-fire on every parent render, but now always invoke the current
callback. Semantics for existing callers are unchanged when their callbacks
are stable; unstable-callback callers (inline arrows) get correct behavior
instead of the first-render closure.

## Verification

- `bun run typecheck` in `cmd/gizzi-code` — clean (exit 0). First run failed
  on 3 pre-existing `Cannot find module '@allternit/os-contracts'` errors in
  `src/runtime/fabric/*` — environmental: the workspace package's `dist/` was
  unbuilt in the fresh worktree; `pnpm run build` in
  `packages/@allternit/os-contracts` fixed it. Not related to this change.

## Known gaps / remaining work

- Desktop binary rebuild (lifecycle step 8) deferred: this touches gizzi-code,
  which the desktop bundles, but the rebuild was outside the scoped task; the
  change is source-canonical and rides the next desktop build.
- Repo-wide react-hooks lint rollout deferred (separate decision, ~360
  compiler artifacts in `src/cli/ui/ink-app`).

## Files changed

- `cmd/gizzi-code/src/cli/ui/ink-app/components/design-system/FuzzyPicker.tsx`
- `.steering/checkpoint.md`
