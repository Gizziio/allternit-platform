# Session attestation — ts burn-down b0020 (ao/ts-burn-next6)

- **Date:** 2026-09-18 (late evening, following ao/ts-burn-next5)
- **Agent:** kimi-code (subagent, batch runner)
- **Branch:** `ao/ts-burn-next6` → **PR #656** → merge commit `4d8130573da90f29d44a979032a9f6058ff76bc9` (merge commit, not squash)
- **Batch:** b0020 (1 file, 1,805 LOC) — 24th burn batch (~481 files cumulative)

## What was done

Burned batch **b0020** of the gizzi-code `@ts-nocheck` burn-down queue
(`cmd/gizzi-code/script/typecheck-burndown/queue.json`): stripped the
`@ts-nocheck` header from `src/cli/ui/ink-app/utils/powershell/parser.ts`
— a **header-only 0-error burn** (strip only; the file needed no type fixes).

- TS2322 probe (`const __tsProbe2322: string = 42`) surfaced exactly 1
  error at `parser.ts(1806,7)`, confirming the stripped file is genuinely in
  the compilation. Probe reverted via `git show HEAD:` content (avoids
  newline artifacts) and the header re-stripped; final tsc 0 errors.
- Sanity-checked the likely error sites before stripping: the
  `memoizeWithLRU` `.cache.delete(string)` access (parser.ts:1287) is
  properly typed in `utils/memoize.ts` (`LRUMemoizedFunction`), so no cast
  was needed.

## Queue state

- b0020: `NEW` → `DONE` in place (`burnedFiles: 1`, `burnedLoc: 1805`,
  note recorded). The burned file had zero overlap with any other live
  batch or the quarantine list (checked before burning).
- stats: totalNocheck 1387 → 1386, totalQueueFiles 973 → 972,
  totalQueueLoc 368774 → 366969. `totalAccounted` untouched (1473);
  `zeroImporter` left for the next regen (b0018/b0019 precedent).
- Identity verified after the edit: live 972 + recorded 481 + quarantined
  20 = 1473 = totalAccounted. `quarantined` untouched; guard count never grew.

## Verification evidence

- `pnpm run typecheck` (ensure-sdk-dist + tsc --noEmit): **0 errors**
  (baseline 0 → strip 0; single header-only file).
- TS2322 probe: 1/1 confirmed type-checked, reverted cleanly.
- `pnpm test` (ci-smoke incl. ts-nocheck burn-down guard): **1329 pass /
  0 fail** (1371 tests, 111 files; SMOKE PASS 111 entries green).
- eslint on the changed file: **1 error before → 0 after** (the removed
  `@ts-nocheck` ban-ts-comment error; zero new issues).
- `node scripts/release-preflight.mjs`: **52 passed, 0 failed**.
- pnpm-lock.yaml untouched. `src/types/*.d.ts` untouched. Never-touched
  list honored (release-desktop.yml, desktop/voice/local-engine surfaces,
  build-production.js run-only, build-queue.mjs, decompile-artifact.mjs).
- Diff self-audit: 2 files changed, 9 insertions, 9 deletions — every
  change is the header strip or the queue.json state record; no logic edits.

## Incidents / deferrals

- None. No escalations (0/1). No latent-runtime-bug candidates.
