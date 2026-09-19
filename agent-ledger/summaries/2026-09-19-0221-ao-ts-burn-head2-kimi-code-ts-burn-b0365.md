# TS burn-down b0365 — attestation (ao/ts-burn-head2)

- **Date:** 2026-09-19 02:21 CDT
- **Agent:** kimi-code (burn-down batch agent, head-of-queue selection)
- **Branch:** `ao/ts-burn-head2` → **PR #675** → merged `6b8050537` (commit `9ec7d995b`)

## What was done

Burned burn-down batch **b0365** (first non-DONE batch in queue order at fetch time): all 28 files stripped of `// @ts-nocheck`, 4,622 LOC. Type-only work; no runtime behavior change; `src/types/*.d.ts` untouched; no escalations; no headers restored.

- 25 files burned header-only with 0 tsc errors after the strip.
- 3 files needed small type-only fixes (5 errors total, converged in 1 iteration — no TS2322 probe required, this was a multi-error burn):
  - `src/cli/ui/ink-app/utils/hooks/AsyncHookRegistry.ts` — the ink-app `entrypoints/agentSdkTypes.ts` stub re-exports only `HOOK_EVENTS`/`EXIT_REASONS` plus generated core types; it does NOT export `HookEvent`, `SyncHookJSONOutput`, or `AsyncHookJSONOutput`. Fixed by importing those from the canonical `src/entrypoints/sdk/coreTypes.js` / `hookTypes.js` (same cross-tree import precedent as `utils/apiErrorMessage.ts`). Also pinned the empty `response` initializer with `as SyncHookJSONOutput` — canonical `HookJSONOutput.success` is required and the previously untyped code initialized `{}`.
  - `src/runtime/tools/builtins/AgentTool/built-in/exploreAgent.ts` / `planAgent.ts` — records carry `disallowedTools` / `model` / `omitClaudeMd`, which the runtime `loadAgentsDir.ts` `BuiltInAgentDefinition` mirror omits (but runtime `AgentTool/prompt.ts` destructures `disallowedTools`). Fixed with local extension types, the established `verificationAgent.ts` sibling pattern (including its TODO(types) note).

## Verification evidence

- `tsc --noEmit` (cmd/gizzi-code): 0 errors at baseline, 5 after strip, 0 after fixes (re-run clean after rebase).
- All 28 burned files confirmed in the tsc program via `--listFilesOnly` (both twin variants of the compact/apiMicrocompact pair).
- `bun test test/ts-nocheck-guard.test.ts`: 5/5 pass — queue internally consistent (totalQueueFiles == Σ batch files), live totalNocheck 1033 == committed stat, every queued file still carries its header, live + recorded burns == totalAccounted 1460 identity exact (759 live + 701 recorded), quarantine stable/disjoint.
- `bash script/check-ts-nocheck.sh`: 1068 → 1035, baseline updated in-commit.
- eslint on all changed files: 0 findings.
- `node scripts/release-preflight.mjs`: 52 passed, 0 failed (no release-path files touched).
- Full `pnpm test` (ci-smoke): **1332 pass / 0 fail / 42 skip**, SMOKE PASS, guard green.
- `scripts/git-discipline-check.sh`: PASS (on main == origin/main 6b8050537, unmerged branches all live-worktree/allowlisted, tree clean).

## Queue state handling

- b0365 was still NEW with all 28 files at pre-strip re-fetch; zero overlap with any other batch's file list; no sibling collision.
- One mid-flight sync: sibling batch b0100 (ao/ts-burn-tail2, PR #674) merged after my worktree was created — committed first, rebased onto fresh origin/main cleanly (no file overlap; queue.json seeded fresh post-rebase).
- `queue.json`: b0365 → DONE (burnedFiles 28, burnedLoc 4622, full note). Stats re-derived from the live tree: totalNocheck 1061 → 1033, totalQueueFiles 767 → 739, totalQueueLoc 306825 → 302203. `totalAccounted` (1460), quarantine (20), `zeroImporter`, and all other batches untouched.

## Incidents / deferrals

- None. Honest note: the ink-app `entrypoints/agentSdkTypes.ts` stub is missing hook-type re-exports that at least two still-queued nocheck files (`types/hooks.ts`, `bootstrap/state.ts`) will need when burned — the canonical-tree import pattern documented here is the fix template.

## Wall time

~25 min total: install+sdk-dist ~2 min, baseline tsc ~1 min, strip+iterate ~6 min (1 fix iteration), gates+queue ~8 min, PR/merge/attestation/teardown ~8 min.
