# Final cut wave — 2 of 4 cuts executed, 2 stopped on pre-cut re-verify

**Session:** ao/final-cut-wave (worktree `allternit-ao-finalcuts`)
**Agent:** kimi-code (subagent) · **Date:** 2026-09-18 2320
**PR:** #654 merged `6bc06e034` (merge commit) — branch `ao/final-cut-wave`, commits
`65df69395` (cut 2) + `8958b6a7f` (cut 4) + `67c8d101a` (decision ledger)
**Base:** `origin/main` @ `00c36f9dd` (rebased over concurrent ao/latent-bug-fixes-p1 merge)

## Owner decision and outcome

Owner decision 2026-09-18: CUT ALL FOUR. Pre-cut re-verification on current main
(queue.json batch membership + `@ts-nocheck` heads, per the stop rule) found two
items had re-entered active burn batches since the morning investigation:

| Cut | Item | Verdict |
|-----|------|---------|
| 1 | `verify_plan_reminder` subsystem (row 22) | **STOPPED** |
| 2 | `skillSearch/prefetch.ts` + 3 gated blocks (row 19) | **EXECUTED** |
| 3 | `attributionTrailer` stub + consumer | **STOPPED** |
| 4 | 4 orphan-scaffold test suites | **EXECUTED** |

## CUT 1 — STOPPED: verify_plan_reminder subsystem

Five of the ~10 edit targets are in active NEW burn batches and still carry
`@ts-nocheck` on current main:

- `src/cli/ui/ink-app/tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts` — batch 42 / b0194
- `src/cli/ui/ink-app/state/AppStateStore.ts` — batch 55 / b0199
- `src/cli/ui/ink-app/utils/messages.ts` — batch 61 / b0060
- `src/shared/utils/messages.ts` — batch 92 / b0091
- `src/cli/ui/ink-app/components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.tsx` — batch 79 / b0211

queue.json is read-only for this lane, so the subsystem cut cannot proceed
without colliding with burn agents. Stop recorded in
`docs/programs/gizzi/DORMANT_STUB_DECISIONS.md` row 22 (owner-decision cell left
as "Owner decision required"). **Re-attempt after b0194/b0199/b0060/b0091/b0211
burn.** Note: the empty `shared/tools/VerifyPlanExecutionTool/constants.ts` shim
(zero importers) remains cut-able independently.

## CUT 2 — EXECUTED: skillSearch/prefetch.ts + gated importer blocks

Row 19 owner decision honored. `feature('EXPERIMENTAL_SKILL_SEARCH')` compiles
OFF in dev and production, so the prefetcher was dynamically unreachable.

- Deleted `cmd/gizzi-code/src/cli/ui/ink-app/services/skillSearch/prefetch.ts`
- Removed gated `skillSearchModules` blocks in both `attachments.ts` copies
  (the `typeof import()` annotations would TS2307 without them)
- Removed gated `skillPrefetch` const + `startSkillDiscoveryPrefetch` /
  `collectSkillDiscoveryPrefetch` blocks in `src/cli/ui/ink-app/query.ts`
- Pruned stale prefetch-architecture comments (turn-0 DCE note, inter-turn
  prefetch note, "moved to prefetch.ts" note) in both attachments copies
- Appended stub path to `cmd/gizzi-code/test/deleted-paths.txt`

Kept deliberately: `skill_discovery` attachment union type in both copies
(type-only; rendering lives in burn-batch-owned `messages.ts` — touching it
would collide with b0060/b0091) and the `skipSkillDiscovery` option param on
`getAttachments`/`getAttachmentMessages` (live caller `processSlashCommand.tsx:907`
still passes it; now a permanently-satisfied no-op). `localSearch.ts` /
`remoteSkillLoader.ts` stay — burn-owned per row 18 (b0141).

## CUT 3 — STOPPED: attributionTrailer stub + consumer

Both `attribution.ts` copies carry `@ts-nocheck` and sit in active NEW burn
batches: `src/cli/ui/ink-app/utils/attribution.ts` in batch 53 / b0198,
`src/shared/utils/attribution.ts` in batch 87 / b0214. The pre-cut condition
("attribution.ts isn't carrying @ts-nocheck in an active batch") fails. The live
961-line attribution engine untouched. **Re-attempt after b0198/b0214 burn.**

## CUT 4 — EXECUTED: orphan-scaffold test suites

Deleted 4 suites asserting contracts against packages/APIs that never existed
(2026-03 reorg orphans): `tests/e2e/workflow.test.ts` (@allternit/shell never a
package), `tests/integration/allternit-e2e.test.ts` (option-taking RuntimeBridge
ctor + `executeTool` never existed), `tests/integration/allternit-runtime-compatibility.test.ts`
+ `tests/integration/runtime-bridge-compatibility.test.ts` (runtime↔lawlayer
delegation contract never wired; import never-existing `_clearActiveSessions`).
Removed their now-dead exclusion comments from `tests/vitest.config.ts`. Test
files only — no `deleted-paths.txt` entries (that manifest guards gizzi-code src).

## Verification evidence (all on the rebased branch)

- `bash script/ensure-sdk-dist.sh` OK (rebuilt os-contracts dist)
- `npx tsc --noEmit` exit 0 — run twice (pre-rebase and post-rebase over the
  concurrent ao/latent-bug-fixes-p1 merge), NODE_OPTIONS=--max-old-space-size=8192
- `bun run test` (cmd/gizzi-code): **1311 pass / 0 fail / 42 skip**, SMOKE PASS —
  dead-code guard accepts the new deleted-paths entry
- `cd tests && npx vitest run --config vitest.config.ts`: **24/24 pass**
- `node scripts/release-preflight.mjs`: **52 passed, 0 failed**
- CUT 2 grep sweep: zero `skillPrefetch` / `skillSearchModules` /
  `skillSearch/prefetch` / `startSkillDiscoveryPrefetch` /
  `collectSkillDiscoveryPrefetch` / `getTurnZeroSkillDiscovery` references outside
  the decision ledger and deleted-paths manifest
- `pnpm install --lockfile-only`: no changes

## Incidents

1. **pnpm install mutated 33 tracked source files** (re-introduced React Compiler
   artifacts + `@ts-nocheck` into `components/permissions/*` and
   `components/messages/UserToolResultMessage/*`, and rewrote
   `script/decompile-artifact.mjs`, `script/ts-nocheck-baseline.txt`, and
   `script/typecheck-burndown/queue.json`). Caught by `git status` before any
   commit; all non-target files restored from HEAD and verified
   `git diff HEAD` empty for queue.json. My 4 edited files were re-verified
   intact. Likely source: a concurrently running codemod lane
   (`ao/artifact-codemod-pilot2` worktree exists) or an install lifecycle hook
   writing outside its own tree. My committed diff contains none of it.
2. First commit attempt accidentally swept the pre-staged test deletions into the
   CUT 2 commit; caught immediately, branch reset to origin/main and re-committed
   cleanly (3 logical commits).

## Honest deferrals

- CUT 1 and CUT 3 are NOT done. They are blocked on burn batches b0194, b0199,
  b0060, b0091, b0211 (cut 1) and b0198, b0214 (cut 3). The queue is read-only
  for cut lanes; once those batches burn (or the owner re-assigns the files off
  the queue), a follow-up lane can execute both cuts using the row 22 / CUT 3
  mapping already recorded.
