# Session attestation — ao/react-dts-fix (React ambient type shadow burn-down)

- **Date:** 2026-09-18 12:29 CDT
- **Agent:** kimi-code (subagent agent-44)
- **PR:** #600 — merged `b119af992695ced5f961d1766a8cedd85f032a46` (merge commit, `--merge`)
- **Branch:** `ao/react-dts-fix` (deleted after merge)

## What was done

Lifted the biggest systemic blocker in the TypeScript burn-down: the permissive
ambient `declare module 'react'` in `cmd/gizzi-code/src/types/react.d.ts` that
shadowed the real React types (flagged by b0002/b0003; b0003 burned two
`TODO(types)` local mirrors because of it).

1. **Added real types:** `@types/react` ^19.2.18 + `@types/react-dom` ^19.2.7
   to `cmd/gizzi-code` (resolved 19.3.0). The workspace-wide pnpm override pins
   `@types/react: ^18.3.28` for the platform's React-18 packages, so the
   override was scoped with `@allternit/gizzi-code>@types/react` /
   `@allternit/gizzi-code>@types/react-dom` selectors in `pnpm-workspace.yaml` —
   no other importer is affected.
2. **Reduced `src/types/react.d.ts`** from a full shadow (40+ declarations) to a
   clearly-marked augmentation file holding only `react/compiler-runtime`
   (ships untyped from react@19.2.4; `@types/react` does not declare it).
   Every deleted declaration (ReactNode, hooks incl. useEffectEvent/
   useActionState/useFormStatus/useOptimistic, Ref, JSX catch-alls, …) is
   provided correctly by the real React 19 types. The global JSX catch-all was
   unnecessary: `ink/global.d.ts` already declares the only custom intrinsics
   (`ink-box`/`ink-text`) on both JSX namespaces.
3. **Found and eliminated a second shadow:** `src/types/global.d.ts` had its own
   `declare module 'react'` block (PropsWithChildren/Dispatch/SetStateAction).
   Empirically, ANY ambient `declare module 'react'` suppresses `@types/react`
   entirely (TS2305 on every hook import). Resolved by rebase onto #599
   (`ao/global-dts-fix`), which independently purged that block plus 53 other
   shadowing/dead ambient modules — took upstream's `global.d.ts` wholesale.
4. **Removed the two b0003 `TODO(types)` mirrors** now that real types flow:
   - `useVirtualScroll.ts`: local `RefObject<T>` → `import type { RefObject }`
     from react; `(React as any).useDeferredValue` shim → real `useDeferredValue`
     import.
   - `use-select-navigation.ts`: `useReducerWithInit` shim → real 3-arg
     `useReducer` overload (returns `[S, ActionDispatch<A>]`).

## Blast radius (honest count)

**Zero burned-file errors surfaced.** No burned call site needed a type-only
fix: the shadow was `any` everywhere and burn-down batches had already written
real-compatible shapes. The only source edits beyond the shadow itself are the
two pre-marked mirror removals (2 files, pure deletions of shims). No
`@ts-nocheck` added or removed; queue.json untouched; no headers re-added.

## Verification evidence

- Oracle: `bash script/ensure-sdk-dist.sh && NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` → **exit 0** on rebased HEAD 28f514676 (this also rebuilt the os-contracts dist, clearing the 6 stale-dist transport.ts errors the #599 session had noted as a tracked blocker — same root cause, resolved by the rebuild).
- `bun run test` → **1311 pass / 42 skip / 0 fail**, SMOKE PASS 107 entries (rebased state).
- eslint on changed files → no new problems (34 problems at base → 5 after; the deleted react.d.ts carried 29; all remaining are pre-existing).
- `node scripts/release-preflight.mjs` → **52 passed, 0 failed**.

## Incidents

- A failed pathspec `git stash push` left `git stash pop` free to pop a FOREIGN
  stash entry (another session's `WIP on chore/remove-vercel`, stash@{0}) into
  this worktree mid-rebase. The foreign entry was kept intact by git (verified
  in `git stash list`); its debris (2 avatar-packs files restored over a
  main-side deletion, an untracked `package-lock.json` and `public/` dir) was
  removed from the worktree tree before continuing. No foreign work lost; the
  stash remains available to its owner session.

## Deferrals / follow-ups

- `react/compiler-runtime` stays a loose augmentation (`(slot: number) => any`)
  — react ships no types for it; tightening is cosmetic.
- Desktop rebuild (lifecycle step 8) skipped: no bundled-code change (types +
  test-time deps only; runtime code paths untouched).
