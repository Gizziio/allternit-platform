# Session attestation — ts burn-down b0022 (ao/ts-burn-next8)

- **Date:** 2026-09-19 00:08
- **Agent:** kimi-code (subagent, batch runner)
- **Branch:** `ao/ts-burn-next8` → **PR #659** → merge commit `57027f18d`
- **Batch:** b0022 (1 file, 1,824 LOC) — 26th burn batch (~504 files cumulative)

## What was done

Burned batch **b0022** of the gizzi-code `@ts-nocheck` burn-down queue
(`cmd/gizzi-code/script/typecheck-burndown/queue.json`): stripped the
`@ts-nocheck` header from
`src/cli/ui/ink-app/tools/PowerShellTool/readOnlyValidation.ts` (PowerShell
read-only command validation — the cmdlet allowlist, pipeline-tail guards,
and external-command flag validators).

- **Header-only 0-error burn** — strip only. TS2322 probe
  (`const __tsProbe2322: string = 42` appended) produced exactly one error
  (the probe itself at line 1825) and zero others, confirming the file is
  in the compilation. Probe reverted via byte-exact reconstruction against
  `git show HEAD:` + re-strip; final diff is the single header deletion.

## Queue state

- b0022: `NEW` → `DONE` in place (`burnedFiles: 1`, `burnedLoc: 1824`,
  note recorded); stats: totalNocheck 1364 → 1363, totalQueueFiles
  950 → 949, totalQueueLoc 359668 → 357844. `totalAccounted` untouched
  (1473).
- Identity verified after the queue edit and again against origin/main:
  live 949 + recorded 504 + quarantined 20 = 1473 = totalAccounted.
  `quarantined` untouched; guard count never grew; target path appears in
  no other batch and not in quarantine.
- No concurrent regen remix: main was unchanged (25 DONE, 503 burned) at
  branch point and at pre-push rebase.

## Verification evidence

- `pnpm run typecheck` (ensure-sdk-dist + tsc --noEmit): **0 errors** —
  3 tsc runs (baseline, post-strip, post-probe-revert), all clean.
- `pnpm test` (ci-smoke incl. ts-nocheck burn-down guard): **1329 pass /
  0 fail** (1371 tests, 111 files), guard green post-queue-update.
- `node scripts/release-preflight.mjs`: **52 passed, 0 failed**.
- eslint: zero new — the only finding on the changed file is the
  pre-existing root-run `custom-rules/no-lookbehind-regex`
  plugin-resolution artifact present at HEAD.
- pnpm-lock.yaml: untouched. `src/types/*.d.ts`: untouched. Never-touched
  list honored (release-desktop.yml, desktop/voice/local-engine surfaces,
  build-production.js run-only, build-queue.mjs, decompile-artifact.mjs).
- Diff self-audit: 2 files changed, 13 insertions, 13 deletions — 1 header
  strip + queue.json state; no logic edits.

## Incidents / deferrals

- None. No escalations (0/1). No latent-runtime-bug candidates found.
