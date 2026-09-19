# ts burn-down b0394 (ao/ts-burn-tail4)

- Date: 2026-09-19 ~02:39–03:20 CDT
- Agent: Kimi Code (burn-down tail agent #4)
- PR: #679, merged `571747449` (merge commit), branch `ao/ts-burn-tail4` (deleted)
- Batch: **b0394** — tail-batch selection (LAST non-DONE at queue read), 10 files / 4,409 queue LOC, state NEW, unclaimed. Zero overlap with concurrently burning siblings.

## What burned

10 files under `cmd/gizzi-code/src`, `@ts-nocheck` stripped, 9 latent type errors fixed type-only:

- **4 header-only 0-error burns**: `cli/ui/ink-app/components/RailsInboxBridge.tsx`, `shared/utils/task/framework.ts`, `shared/utils/inProcessTeammateHelpers.ts`, `shared/utils/swarm/spawnInProcess.ts`.
- **mcpServer.ts** (TS2420): the vendored `allternitInChrome/extension.ts` stub types `Logger` as a bare function type `(...args: unknown[]) => void` (the real `@allternit/extension` package is not vendored in this repo), which a method-bag class can never implement. Dropped the unsatisfiable `implements Logger` clause and its now-unused type import. Runtime unchanged.
- **doctorDiagnostic.ts** (TS2345 x2): `MACRO`'s `[key: string]: unknown` index signature makes `MACRO.PACKAGE_URL` `unknown`; the `join(npmPrefix, 'node_modules', packageName)` sites needed a local `string[]` annotation + `as string`.
- **ide.ts** (TS2339 x2 + **latent runtime bug**): both `ideOnboardingDialog()` call sites called `.hasIdeOnboardingDialogBeenShown()` on the lazy dynamic-import **Promise** without awaiting — a guaranteed `TypeError` at runtime whenever the IDE-onboarding suppression check fires. Fixed by awaiting the import (`(await ideOnboardingDialog()).has…()`); the enclosing `.then(status => …)` was made `async` to allow the await (second call site was already in an async callback). This is the same fix described in the b0220-era allowlist note — the await had been lost in a subsequent refactor. One-line-class latent-bug fix per playbook, noted.
- **logoV2Utils.ts** (TS2339): `MACRO.VERSION_CHANGELOG` is `unknown` via the index signature; local `as string | undefined` wrapper.
- **download.ts** (TS2464 x2): computed property names `[MACRO.NATIVE_PACKAGE_URL!]` — the non-null assertion does not narrow `unknown`; replaced with `[(MACRO.NATIVE_PACKAGE_URL as string)]`.
- **InProcessBackend.ts** (TS2345): `ToolUseContext.setAppState` is optional on paper but always present in the context TeammateTool installs via `setContext()`; type-only assertion `this.context as SpawnContext` (imported the type). No runtime branch added.

## Iteration histogram

`9 → 1 → 0` across 3 tsc iterations (multi-error burn, so no TS2322 probe). Well under the ~8-iteration / 30%-escalation stop gates. Escalations: none. Allowlist: untouched (no entries needed).

## Queue bookkeeping — retired-id absorption (b0337 precedent)

Mid-flight, TWO sibling merges landed on origin/main before my push:

1. `ao/artifact-codemod-pilot7` (PR #677) — its deterministic queue regen **retired the b0394 id entirely** and remixed my 10 files into **b0421** (17 files). It also decompiled 33 compiler artifacts (`excludedCompilerArtifacts` 181→148) and dropped the b0369–b0394 absorption records.
2. `ao/ts-burn-head4` (b0031, PR #678) — a 1-file burn on top.

Resolution per playbook: committed, rebased onto fresh origin/main (twice), queue.json conflict seeded **from main's queue** (`--ours` during rebase — the `--theirs/--ours` swap burned one resolution attempt, caught by a stats sanity check), then:

- removed my 10 files from b0421 (17→7 files, its `loc` re-derived from live line counts),
- re-added a `b0394` record (`state: DONE`, `burnedFiles: 10`, `burnedLoc: 4409`) with an absorption note, appended at the end of `batches` (batchCount 102→103),
- stats re-derived from live scans: `totalNocheck` 998→988, `totalQueueFiles` 737→727, `totalQueueLoc` 300,694→316,748 (b0421's loc re-derived), `zeroImporter`/quarantine/exclusions from live scan; `totalAccounted` **untouched** (1460; identity exact: live 747 + recorded 713 = 1460 ✓), quarantined untouched, other batches untouched.

## Verification evidence

- `tsc --noEmit`: 0 errors at strip-convergence, **0 errors post-rebase** (direct `node node_modules/typescript/bin/tsc`, exit 0).
- Smoke `ci-smoke-test.sh` (post-rebase, two runs): **ts-nocheck guard 5/5 PASS** every run; 1,324 pass. **Honest deferral: 8 failures, all pre-existing environmental** — `file.ripgrep` x2, `tool.grep` x3, `Mesh join precedence` x3, every one a 30 s subprocess-spawn timeout (`rg`/`tailscaled`) during a machine-wide process-spawn wedge that also wedged two of my own gate runs (0% CPU, never exec'd). Reproduced identically on the **unmodified shared main checkout** (`test/file/ripgrep.test.ts`: 0 pass / 2 fail, 60 s). Not caused by this change; the wedge cleared for foreground spawns later in the session.
- ESLint on the 10 files: **zero new** — 11 problems in the burn tree map 1:1 to the 19-problem baseline on main modulo header-removal line shifts (the 8 `@typescript-eslint/ban-ts-comment` baseline errors are removed by this burn; remaining 6 errors + 5 warnings pre-existing: `custom-rules/*` "definition not found" config-env issues, `no-constant-binary-expression` on the deliberate `...(true && …)` DCE scaffold, `preserve-caught-error` x2).
- `node scripts/release-preflight.mjs`: **52 passed, 0 failed**.
- pnpm-lock untouched; `src/types/*.d.ts` never edited; forbidden paths untouched.
- Post-merge `git pull --ff-only` clean; `scripts/git-discipline-check.sh` **PASS** (on main == origin/main 571747449, worktree clean, no unmerged stale branches of mine).

## Incidents / notes for the next burner

- **macOS spawn wedge (~02:43–03:10)**: batches of node processes spawned via background tasks wedged at 0% CPU before exec (shim and direct alike; tail5 sibling hit the same). Killing and respawning cleared it; `node <bin>` direct invocation worked throughout. If gates hang at 0% CPU with empty logs, kill and respawn rather than waiting.
- The `MACRO` index-signature `unknown` pattern (`PACKAGE_URL`, `NATIVE_PACKAGE_URL`, `VERSION_CHANGELOG`) will recur in any file using those keys — the local `as string` / `as string | undefined` wrapper is the approved type-only fix.
- The `ideOnboardingDialog()` lazy-import Promise bug was previously "fixed and burned" per the b0220-era allowlist note, but the file returned to the queue with the bug un-fixed — worth a sweep for other resurrected un-fixed burns.
- b0421 (7 files remaining, incl. `railsPeer.ts`, `autoUpdater.ts`, `thread.ts`) is the new LAST non-DONE tail batch.
