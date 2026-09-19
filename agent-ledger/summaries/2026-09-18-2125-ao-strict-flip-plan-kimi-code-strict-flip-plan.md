# Attestation — ao/strict-flip-plan (strict-mode flip plan)

- **Date:** 2026-09-18 ~21:25 CDT
- **Agent:** Kimi Code (subagent), worktree `allternit-ao-strictplan`, branch `ao/strict-flip-plan`
- **PR:** #640 (merged, merge commit `ffda05590f5cdf011d8742c636bf80a5e6b461d5`)
- **Change:** `docs/programs/gizzi/STRICT_FLIP_PLAN.md` only — 305 lines added, zero code/config edits. Plan for the strict-mode flip phase that follows the `// @ts-nocheck` burn-down.

## What was done

Produced the phase plan for flipping `cmd/gizzi-code/tsconfig.json` from
`strict: false` + `noUncheckedIndexedAccess: false` to the strict
`@tsconfig/bun` base. Contents: full strict-family flag inventory; live
per-flag `tsc --noEmit --<flag>` measurements on main @ `56085d0db`; a
4-phase sequencing (noImplicitAny → strictNullChecks → noUncheckedIndexedAccess
(re-measured) → trivial tail + config flip); a burn-down-style execution plan
(lanes, batches, dual-oracle verification, new strict-flip ratchet guard);
risk register.

## Live measurements (2026-09-18 ~21:05–21:21 CDT, TS 5.9.3, main @ 56085d0db)

- Baseline `tsc --noEmit` (unmodified config): 0 errors.
- `--strictNullChecks`: 212 errors / 110 files (TS2345 ×66, TS18048 ×58,
  TS2339 ×50). Morning probe was ~138; growth is burn-down progress exposing
  more files.
- `--noImplicitAny`: 293 errors / 141 files (TS7011 ×147, TS7053 ×52,
  TS7018 ×39, TS7006 ×28).
- `--noUncheckedIndexedAccess`: 0 errors — no-op without strictNullChecks;
  flagged as a re-measure requirement, not "clean".
- `strictBindCallApply` / `noImplicitThis` / `alwaysStrict`: 0.
  `strictFunctionTypes`: 2. `useUnknownInCatchVariables`: 3 (one file).
  `strictPropertyInitialization`: unprobeable standalone (TS5052).
- Full `--strict`: 221 errors / 145 files (212 src / 8 test / 1 packages).

## Verification evidence

- All probes run in the worktree after `bash script/ensure-sdk-dist.sh`,
  `NODE_OPTIONS=--max-old-space-size=8192`; no tsconfig/source/queue.json
  modification (CLI flags only, per plan).
- `git show --stat ffda05590f` — one file changed, 305 insertions.

## Honest deferrals / notes

- Phase 3 (`noUncheckedIndexedAccess`) error count is genuinely unknown
  until strictNullChecks lands; the plan budgets a re-measure instead of a
  number.
- The React-Compiler de-compile codemod (8–12 PRs, separate track) does not
  gate the strict flip — artifacts keep `@ts-nocheck` headers that suppress
  strict errors; the plan documents this explicitly.
- Burn-down (~85 batches remaining at measurement time) must complete first;
  the plan gates on it.
- `/tmp/strict-*.txt` raw probe outputs are session scratch and were not
  committed.
