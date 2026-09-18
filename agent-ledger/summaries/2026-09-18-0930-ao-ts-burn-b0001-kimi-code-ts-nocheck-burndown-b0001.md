# Attestation — ao/ts-burn-b0001 (pilot batch of the @ts-nocheck burn-down)

- **Date:** 2026-09-18 0930
- **Session:** ao/ts-burn-b0001 (worktree `allternit-ao-tsburn-b0001`, branch `ao/ts-burn-b0001`)
- **Agent:** kimi-code (pilot subagent)
- **PR:** #586 — merge commit `53587c6b4`

## What was done

Burned down pilot batch **b0001** from `cmd/gizzi-code/script/typecheck-burndown/queue.json` (242 files / 7,064 LOC, first leaf-most batch). 226 files had their `// @ts-nocheck` header removed and all newly-visible type errors fixed **type-onlyly** (annotations, `override`, narrowing casts, ambient module declarations, interface/type widening, import elision). 16 files escalated (headers restored, kept listed in queue.json `b0001` with per-file reasons).

## How it works / key decisions

- **queue.json handling:** b0001 marked `state: "DONE"` retaining the 16 escalated files; stats updated (`totalNocheck` 2235→2009, `totalQueueFiles` 1781→1555, `totalQueueLoc` 522165→515342, `batchCount` 108 unchanged). Header removals + queue.json edit landed in the same PR per the guard contract.
- **Escalations (16 = 6.6% of batch, below the 30% stop threshold):** 12 malformed "TEMPORARY SHIM" stubs with genuinely invalid JS/JSX grammar (unbalanced braces — `export default` inside function bodies); 4 dead re-export shims needing banned import-specifier changes (`src/runtime/components/Markdown.ts` case-mismatched specifier TS1261; `ink-app/utils/udsClient.ts` re-exporting a nonexistent module; two `src/cli/ui/utils/*` shims with wrong relative paths, zero importers).
- **Collateral type-only edits (3 files outside batch):** `src/types/global.d.ts` (proper-lockfile `lockSync` — verified against installed 4.1.2 runtime API; ambient `cli-highlight`/`highlight.js` declarations — neither installed, both only dynamic-imported inside try/catch); `runtime/.../AgentTool/loadAgentsDir.ts` (`BuiltInAgentDefinition` → Omit-based alias matching the ink-app record shape keyed by `agentType`; intersection type predicate); `src/runtime/shared/utils/permissions/PermissionResult.ts` shim (empty auto-generated stub now re-exports canonical types).
- **`tsconfig.typecheck.json` added** (incremental + tsBuildInfoFile, extends ./tsconfig.json) — the incremental loop driver; `.tsbuildinfo*` already gitignored.
- **Symlink discovery:** `src/cli/ui/ink-app/utils/protectedNamespace.ts` is a git-tracked symlink to `src/shared/utils/protectedNamespace.ts` — one physical file appeared twice in the batch. Strip/restore tooling must dedupe by realpath. Builder/guard may want to account for this.

## Verification evidence

- Cold baseline `npx tsc --noEmit` exit 0 (14s).
- 5 tsc iterations on `tsconfig.typecheck.json`: 44 errors at first removal → 0. Warm iterations ~18s.
- Full non-incremental `npx tsc --noEmit` exit 0 (32s).
- `bun run test` cmd/gizzi-code: **1309 pass / 0 fail** (57.5s), `SMOKE PASS: 107 entries green`; guard test directly 3/3.
- `node scripts/release-preflight.mjs`: **52 passed / 0 failed**.
- Diff self-audit: 219 header-only diffs + 9 type-only diffs; 0 strays (every changed path ∈ batch ∪ 3 collateral).
- eslint gate **degraded, pre-existing**: root `eslint.config.js` imports `typescript-eslint` which no package.json declares — config fails to load in this and the shared checkout. Diff verified to add 0 `eslint-disable` lines.

## Pilot metrics

- Setup: pnpm install 58s, ensure-sdk-dist 6s. Total fix wall (strip→green): ~35 min including investigation.
- Error histogram at first removal (44 total, 20 files): TS1184×15, TS1258×8, TS2307×6, TS2339×5, TS2724×2, TS2305×2, TS2322×2, TS4114×1, TS2694×1, TS2353×1, TS1261×1. Per-file mean 2.2, max 6.
- Casts introduced: 3 (`as A` narrowing ×2, `as unknown as` TODO(types) ×1). TODO(types) markers: 2.
- Final diff: 141 insertions / 484 deletions across 230 files.

## Incidents / honest deferrals

- Concurrent-session interference: `origin/main` advanced twice during the run (PRs #584/#585); handled by diffing vs HEAD and merging via GitHub (no conflicts — their changes were docs/Cargo-path only).
- eslint gate unrunnable repo-wide (see above) — flagged for a follow-up; the burn-down batches keep adding zero eslint-disable lines as the enforceable subset.
- The 16 escalated shim files remain nocheck'd and need a dedicated cleanup pass (brace repair = runtime-shape decision; specifier fixes = behavior decision) — owner decision, tracked in queue.json `b0001.escalated`.
- Worktree `allternit-ao-tsburn-b0001` + branch cleanup not yet done at attestation time (session continues to git-discipline step).
