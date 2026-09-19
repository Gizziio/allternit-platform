# Latent runtime bug fixes P1/P2/P4 + b0142 escalations — session ao/latent-bug-fixes-p1

- **Date:** 2026-09-18 2317
- **Agent:** kimi-code (subagent, owner-approved "FIX ALL" lane)
- **PR:** #653 merged `aa37f2fa3c77706ac734bc7ffcea46e500243a1a` (merge commit), branch `ao/latent-bug-fixes-p1`

## What was done

Executed the platform rows of `docs/programs/gizzi/LATENT_BUG_DECISIONS.md` (per-item
diagnoses re-verified on current main before fixing) plus the two b0142 escalations from
burn batch `ao/ts-burn-next3` (PR #646). Seven commits, conventional, one per bug:

- **P1 — dead vfkit VM path in cowork runtime (cut).** `cowork.runtime.ts` dynamically
  imported `createVFKitManager` from `@/runtime/vm`, which exports only the Lima surface —
  every `mode:"vm"` run failed with "createVFKitManager is not a function". Removed
  `getVfkitManager`/`executeVM` and the unused `VmSession` import; vm-mode runs now fail
  with a descriptive error pointing at the cron CoworkExecutor. "vm" intentionally remains
  a valid stored/API mode (the b0142 schema fix adds it to the drizzle mode union), so the
  RunMode union was NOT narrowed. Test: `test/runtime/cowork-runtime-vm.test.ts` (2).
- **P2 — SDK Hooks type drift.** Declared the five runtime-triggered hooks in
  `packages/plugin/src/index.ts` (`shell.env`, `tool.definition`,
  `experimental.chat.system.transform`, `chat.params`, `experimental.text.complete`) with
  payload shapes taken from the call sites; dropped all six `as any` hook-name casts
  (bash.ts, pty/index.ts, registry.ts, agent.ts, llm.ts ×2, processor.ts). Tracked plugin
  dist rebuilt. Test: `test/plugin/hooks-contract.test.ts` (5).
- **P4 — dead `identity.creature` accessor.** No identity source produces `creature`
  anywhere in the tree, so the "add + populate" option had nothing to populate from;
  deleted the always-undefined cast read and inlined the fallback description.
- **b0142-1 — `Filesystem.stat` self-shadowing infinite recursion.**
  `src/runtime/util/filesystem.ts` imported `stat` from fs/promises but the namespace's own
  exported `stat` shadowed it — `Filesystem.stat()/isDir()/isFile()/copy()` recursed into
  themselves. Aliased the import (`stat as fsStat`), repointed all eight internal call
  sites; widened the namespace `glob` options type to match `globUp`. Test:
  `test/runtime/util-filesystem.test.ts` (5).
- **b0142-2 — cowork service schema drift.** Interfaces declare `created_at`/`updated_at`/
  `responded_at`/`restored_at` + boolean `enabled`/`resumable`; drizzle stores
  `time_created`/`time_updated`/`time_responded`/`time_restored` + integer booleans, so the
  `as Run[]` casts handed consumers `undefined` timestamps (zod routes + `new Date()` CLI
  choke). Added boundary row mappers for all five entities at every read site; added the
  missing `"vm"` to both schema mode `$type` unions. Test:
  `test/runtime/cowork-service-mapping.test.ts` (6).

Both `@ts-nocheck` files (filesystem.ts, cowork.service.ts) keep their headers — they are
queued in NEW burn batch b0180 and queue.json must not be hand-edited; no batch was ACTIVE
for any target (all DONE/NEW), so nothing was deferred for queue conflicts. P3 marked
WON'T (intentional USER_TYPE DCE pattern); P5 verified already fixed by burn b0102
(commit `0f7c246aa`) and marked DONE.

## Verification evidence

- `bash script/ensure-sdk-dist.sh && NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` → exit 0 (post-rebase).
- `bun run test` smoke → **1329 pass / 0 fail / 42 skip**, 1371 tests across **111 entries**
  (was 107/1311 — the 4 new test files are in smoke.txt), incl. ts-nocheck-guard 5/5 and
  dead-code-guard.
- `node scripts/release-preflight.mjs` (repo root) → **52 passed, 0 failed**.
- eslint on all 18 changed files → zero new problems (baseline A/B vs merge-base versions:
  17 errors before = 17 after; the findings are pre-existing namespace / ban-ts-comment
  patterns in queued nocheck files).
- Rebase onto origin/main before push (main moved +11 during the session, codemod/burn
  agents landing concurrently); all gates re-run green post-rebase.

## Incidents / notes

- **Latent migration bug surfaced (NOT fixed — out of scope):** `migration/20260414094100_cowork_runtime/migration.sql`
  has no `--> statement-breakpoint` separators, so `Database.applyMigrations` (splits on the
  marker) executes only its first statement on a fresh DB: `cowork_run` exists but
  `cowork_run_event`/`cowork_schedule`/`cowork_approval`/`cowork_checkpoint` are never
  created. Recorded in LATENT_BUG_DECISIONS.md for follow-up (regenerate the migration or
  apply statements individually). The new cowork tests apply the cowork DDL directly and
  carry a NOTE explaining why.
- The two escalated files and `session/prompt.ts` appear in queue.json only under NEW
  batches (b0180/b0026) — no ACTIVE-batch deferrals needed.

## Honest deferrals

- P3 hygiene (centralize the USER_TYPE DCE family behind `isAntBuild()`) — WON'T row, not
  a bug fix; left to a future sweep.
- Cowork migration statement-breakpoint fix — separate latent bug, needs its own owner
  decision (regenerating a shipped migration vs. a repair migration).
