# ts burn-down b0142 — session ao/ts-burn-next3

- **Date:** 2026-09-18 2215 (start), merged same session
- **Agent:** kimi-code (subagent batch runner)
- **PR:** #646 merged `cc91d7146765cfcfd9c5bcec52c6ce53c4d478e8` (merge commit)

## What was done

Batch **b0142** of the gizzi-code `@ts-nocheck` burn-down: 20 queued files, 7,184 loc. Burned **18 files (6,290 loc)**, converged in **2 tsc iterations**. Branch `ao/ts-burn-next3` from `origin/main` (1b0c250f5), worktree `allternit-ao-tsburn-next3`.

- **17 header-only 0-error burns** (headers stripped, nothing else).
- `src/runtime/integrations/plugin/claude/loader.ts`: 3 type-only `as string` casts on gray-matter frontmatter values (`description`, `argument-hint`, `model`) assigned into typed `ClaudePluginCommand` fields (TS2322, lines 179–182).
- **Escalated 2 files** (headers restored, kept live in b0142's record):
  - `src/runtime/util/filesystem.ts` — **latent runtime bug**: the `Filesystem` namespace's exported `stat` (line 226) resolves `stat` to its own hoisted declaration, shadowing the `fs/promises` import → infinite self-recursion; `isDir`/`isFile`/`copy` build on it. Verified dormant (no live importer calls these methods — importers use `readFile`/`write`/etc.). Also surfaced: `glob()` options type `{ cwd?: string }` narrower than the `{ cwd, absolute: true }` call in `globUp`. Fix needs a runtime change (alias the import); outside type-only scope.
  - `src/runtime/cowork/cowork.service.ts` — **schema drift hidden by casts**: hand-written `Run`/`RunEvent`/`Schedule`/`Approval`/`Checkpoint` interfaces declare `created_at`/`updated_at`, but the drizzle schema (`cowork.sql.ts` via `Timestamps`) stores `time_created`/`time_updated` — the `as Run[]` etc. casts return rows whose `created_at` is `undefined` at runtime, which `src/runtime/server/routes/cowork.ts` (`created_at: z.number()`) and the CLI (`new Date(run.created_at)`) would choke on; the schema `mode` `$type` (`"local"|"remote"|"cloud"`) also omits `"vm"` that `RunMode` declares and `RunService.create` accepts. Fix needs a runtime mapping change; outside type-only scope. (Cowork is default-disabled, so the drift is dormant in the default product.)

## Verification evidence

- Baseline tsc (headers intact): **0 errors**. Post-strip: 22 errors (13 cowork.service, 7 filesystem, 3 loader) → after escalating the 2 files and the 3 loader casts → **tsc 0 errors** (`NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc --noEmit`, worktree `cmd/gizzi-code`).
- **TS2322 probe 18/18**: a probe line was appended to each burned file; one tsc run confirmed every file reported TS2322 at its probe (all 18 in compilation); probes reverted, strips re-applied, trailing-blank-line residue cleaned, diff re-audited (exactly 18 header removals + 3 casts).
- Smoke: `bash script/ci-smoke-test.sh` → **107 entries green, 0 fail** (1,353 tests), including the ts-nocheck guard 5/5 (guard failed 3/5 pre-queue-update — expected sequencing, green after).
- eslint (root config) on the 18 changed files: **zero new problems** — the 9 branch findings are line-shifted (+1) copies of pre-existing main findings; 15 `ban-ts-comment` errors removed (26 → 9 problems).
- `node scripts/release-preflight.mjs`: **52 passed, 0 failed**.
- No pnpm-lock churn; no never-touch paths touched.

## Queue state

b0142 → DONE: `burnedFiles: 18`, `burnedLoc: 6290` (queue-time line counts; 18 files = 6,290 + 2 escalated = 894 → 7,184 ✓), residue `files: [src/runtime/util/filesystem.ts, src/runtime/cowork/cowork.service.ts]` (loc 894) with `escalated[]` reasons + note. Stats re-derived: totalNocheck 1516→1498, totalQueueFiles 1043→1025, totalQueueLoc 389458→383168, `totalAccounted` **untouched** (1473). Identity verified: live 1045 + recorded 428 = 1473; quarantined (20) disjoint; no duplicate listings; batchCount 102.

## Incidents / notes

- Concurrent-worktree hygiene: codemod-pilot (`ao/artifact-codemod-pilot1`) untouched; no rebase needed (main did not move during the burn).
- Escalation rate 2/20 (10%) — below the 30% stop threshold; iterations 2 — well under the ~8 stop rule.

## Honest deferrals

- The two escalated files need owner-visible follow-up: a one-line runtime fix for `Filesystem` (alias `stat as fsStat` inside the namespace) and a cowork schema/service mapping decision (map `time_created`→`created_at` at the service boundary or align the interfaces; add `"vm"` to the schema mode `$type`).
