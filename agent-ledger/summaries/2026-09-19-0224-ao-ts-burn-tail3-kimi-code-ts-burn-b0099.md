# TS burn-down b0099 (ao/ts-burn-tail3)

- **Date:** 2026-09-19 02:24 CDT
- **Batch:** b0099 — 1/1 files burned (1,507 queue LOC; 1,513 post-burn)
- **File:** `cmd/gizzi-code/src/shared/utils/gizzimd.ts` (the runtime/shared twin; the ink-app twin `src/cli/ui/ink-app/utils/gizzimd.ts` remains queued under b0041)
- **PR:** #676, merged `4346eab0b` (merge commit), branch `ao/ts-burn-tail3` @ `8ae8f5e71`

## What was done

Stripped the `// @ts-nocheck` header. 3-error burn (NOT header-only, so no TS2322 probe
needed — real errors confirmed the file is in compilation), converged in 1 fix round
(3 → 0), whole-project `tsc --noEmit` 0 at baseline, after strip+fix, and post-rebase.

## Type-only fixes

1. `teamMemPaths` require cast (TS2339 x2): the `feature('TEAMMEM')` branch calls
   `isTeamMemoryEnabled()` / `getTeamMemEntrypoint()` on
   `src/shared/memdir/teamMemPaths.ts`, a live empty module (`export {}`). The old
   `as typeof import(...)` cast referenced members that do not exist. Widened the local
   require cast to a structural contract declaring exactly the two members used.
   Deliberate DCE feature flag preserved — no runtime behavior change.
2. `getMemoryFiles.cache` access (TS2339): the ambient `lodash-es/memoize.js` shim in
   `src/types/global.d.ts` returns `T` without lodash's runtime `.cache` property
   (`.d.ts` files are never edited in this burn-down). Pinned via
   `(getMemoryFiles as any).cache?.clear?.()` — the exact precedent in
   `claudeai.ts` `clearClaudeAIMcpConfigsCache`. Existing `?.` chain semantics kept.

## Queue state handling

- Tail-batch selection: LAST non-DONE batch in queue order = b0099 (single file).
  Pre-strip re-fetch confirmed b0099 still NEW; no collision.
- One mid-flight sibling merge absorbed: head2 b0365 (PR #675, 28 files) merged after
  my worktree was created. Rebased `ao/ts-burn-tail3` onto fresh `origin/main`;
  `queue.json` conflict resolved by seeding from `origin/main`'s queue (totalNocheck
  1061→1033 there), removing my burned file, marking b0099 DONE (burnedFiles 1,
  burnedLoc 1513), and re-deriving `totalQueueFiles`/`totalQueueLoc` from the live
  tree (739→738, 302203→300667). `totalAccounted` (1460) and quarantine untouched;
  no other batch's records modified.
- Note: `src/shared/utils/gizzimd.ts` appears only in b0099; `b0041`'s similarly named
  file is the ink-app twin (different path) — untouched.

## Verification evidence

- `tsc --noEmit`: 0 errors (baseline, post-fix, post-rebase — 3 runs)
- Smoke (`script/ci-smoke-test.sh`): 1332 pass / 0 fail / 42 skip, 111 entries green,
  `ts-nocheck-guard` 5/5 (first guard run pre-queue-amend failed exactly on the
  unrecorded burn — expected; green after queue.json update)
- `scripts/release-preflight.mjs`: 52 passed / 0 failed
- eslint: package has no eslint config (`bun run lint` = tsc) — no new lint surface
- pnpm-lock.yaml / `src/types/*.d.ts` untouched; no allowlist changes; 0 escalations

## Gates / discipline

- git-discipline-check.sh: PASS (on main == origin/main 4346eab0b; 10 branches, 5
  unmerged all live-worktree/allowlisted; worktree clean)
- Shared checkout synced `git pull --ff-only` 39ce4be52..4346eab0b (first attempt).

## Deferrals / follow-ups

- The ink-app twin `src/cli/ui/ink-app/utils/gizzimd.ts` (b0041) still carries
  `@ts-nocheck` — its burn will likely hit the same two patterns (teamMemPaths empty
  module, memoize `.cache`).
- `src/shared/memdir/teamMemPaths.ts` being an empty module behind a never-on feature
  flag is either dead code or an unfinished feature; out of scope for type-only burns.
