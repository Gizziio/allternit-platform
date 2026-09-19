# ts burn-down b0220 (ao/ts-burn-next9)

- **When:** 2026-09-19 00:54 CDT
- **Agent:** kimi-code (subagent, burn-down playbook)
- **PR:** #663, merge commit `b0a2cea5a4a9870105a159d42f837a313965d91c` (branch `ao/ts-burn-next9`, worktree `allternit-ao-tsburn-next9`, torn down)
- **Batch:** b0220 — 22 files / 7,285 LOC from `cmd/gizzi-code/script/typecheck-burndown/queue.json`

## What burned

22 files stripped of `// @ts-nocheck`: 16 header-only 0-error burns, 6 files with
13 errors converged in **1 iteration** (`useIdeLogging.ts` / `useIdeSelection.ts`
were already de-headered by the concurrent `ao/artifact-codemod-pilot4` regen and
are counted in the batch). TS2322 probe: append `const __probe: string = 42` to
each file → exactly 22 probe errors, zero others → all 22 confirmed in
compilation; reverted byte-exact via `git show HEAD:` + re-strip.

### Type-only fixes

- `HistorySearchDialog.tsx`: explicit `enabled` arg (`true` = prior default) —
  the decompiled `useRegisterOverlay(id, t0)` signature has no parameter default.
- ink-app `services/api/sessionIngress.ts`: local `type UUID = string` wrapper
  replacing the branded `crypto` UUID template-literal import (runtime twin
  pattern; type-only).
- `utils/context.ts`: restored missing `resolveAntModel` import from
  `./model/antModels.js`.
- `utils/ide.ts`: `await` the lazy `ideOnboardingDialog()` dynamic import at both
  call sites — the exact latent runtime bug `ao/ts-burn-next10` escalated as
  b0255 (`.hasIdeOnboardingDialogBeenShown()` invoked on the Promise). Fixed here
  instead of allowlisting; `ide.ts` removed from `test/ts-nocheck-allowlist.txt`.
- `utils/filePersistence/outputsScanner.ts`: `entries` pinned to `fs.Dirent[]`
  (readdir overload generic mismatch `Dirent<string>` vs `Dirent<NonSharedBuffer>`).
- `services/api/referral.ts`: local referral response types — `../oauth/types.js`
  is a dead `types_ts` shim with no real exports (same dead shim next10 hit in
  `Passes.tsx`). `amount_minor_units` optional with graceful `formatCreditAmount`
  fallback; `referral_code_details` added.
- `components/Passes/Passes.tsx` (seam, type-only import): takes
  `ReferrerRewardInfo` from `services/api/referral` — the surface both decompiled
  files originally shared — instead of the runtime twin's divergent
  `rewardAmount` shape (runtime twin requires `rewardAmount`/`threshold`; the
  decompiled call sites read `amount_minor_units`, so the shapes are
  irreconcilable at the seam and the ink-app authority wins).

## Queue handling (heavily remixed by concurrent agents)

Three concurrent landings moved main under this batch: pilot3 regen (PR #660),
`ao/ts-burn-next10` b0255 (PR #661), pilot4 regen (PR #662). Final queue edit,
seeded from pilot4's regen:

- b0220 retired DONE record added (burnedFiles 22, burnedLoc 7285).
- 20 still-queued files de-listed from b0299/b0300/b0301/b0319 (2 of the 22 were
  already de-listed by pilot4's regen; no batch emptied).
- stats: totalNocheck 1288→1268, totalQueueFiles 934→914, totalQueueLoc
  352476→345384, totalAccounted 1458→1460 (identity: 914 + 20 quarantined +
  526 recorded = 1460; guard-verified).
- quarantined untouched (20, disjoint). version kept at 1 (`expect(queue.version).toBe(1)`).

## Verification

- `tsc --noEmit`: 0 errors (baseline, post-strip, post-seam-fix, post-rebase runs).
- smoke: **1329 pass / 42 skip / 0 fail**, "SMOKE PASS: 111 entries green",
  burn-down guard green (5 guard invariants re-verified arithmetically first).
- `node scripts/release-preflight.mjs`: 52 passed / 0 failed.
- eslint: zero new — per-file comparison against HEAD content linted with the
  worktree's own config (the shared checkout's older `@eslint/js` resolves a
  smaller rule set; not a valid baseline). All 11 errors + 11 warnings on the
  burned files pre-exist; 22 `ban-ts-comment` errors removed.
- pnpm-lock churn reverted; never touched: release-desktop.yml,
  surfaces/allternit-desktop, services/voice, services/local-engine,
  build-production.js (run-only preflight), src/types/*.d.ts, quarantined,
  build-queue.mjs (ran read-only + one sanctioned regen experiment, reverted).

## Incidents / honest notes

- First queue edit was written against the pre-pilot4 queue and had to be
  redone after rebasing; a `git checkout --theirs` during the first rebase
  briefly took the wrong side (rebase ours/theirs inversion) — caught by
  diffing against `origin/main` and redone.
- One sanctioned `build-queue.mjs` regen was run experimentally mid-flight to
  understand the codemod skew; its output was discarded in favor of the
  surgical edit (the regen erased burn attribution by deriving accounted from
  disk alone).
- The concurrent-agent churn (4 main advances during this batch) meant the
  post-rebase tree was not re-probed; compilation membership was established
  pre-rebase (22/22) and the two seam files were verified by the final 0-error
  full-project tsc.
- The `referral.ts` vs runtime-twin `oauth/types.ts` shape divergence
  (`amount_minor_units` vs `rewardAmount`) is a real API-generation mismatch
  worth a follow-up: one of the two surfaces is stale.
