# Steering checkpoint — TS burn-down marathon (orchestrator session, 2026-09-19)

## Goal
Drain the ts-nocheck burn queue (~61 NEW batches left), finish compiler-artifact codemod (pilot 9 in flight, 121 artifacts remain), then strict-flip phases 1–4 per STRICT_FLIP_PLAN.md, then final wrap-up.

## Just did
- Merged + attested: pilot 8 (PR #681, artifacts 148→118), b0034 (PR #682), b0097 (PR #683), b0439 (PR #685), b0395 40-file burn (PR #686). Queue 44/105 DONE, 677 files / 279,734 LOC left, nocheck 908. Main @ f8eb5d43f, discipline PASS.
- Rotated lanes: head-4 (front, ≠b0422), head-5 (middle NEW), tail-4 (back) + codemod pilot 9. All in flight, no open PRs yet.
- **Strict-flip re-measure on current main (2026-09-19, main @ f8eb5d43f, TS with 8GB heap, after ensure-sdk-dist): noImplicitAny = 1,166 errors / 1,165 files (TS7006 ×633 dominant); strictNullChecks = 610.** Plan doc measured 293/212 on 2026-09-18 when ~750 files still had suppressing @ts-nocheck headers; every burned file newly exposes these errors. Phase 1 will be ~4x the plan's estimate — re-scope lane budget at phase start per the doc's own re-measure contract.

## Next
- Merge lane PRs as they land (queue.json union-rebase pattern: take the lane's queue for absorption structure, add main-side batch retirements; guard must be 5/5).
- After queue empties: codemod final PR (stub deletion) per INK_APP_COMPILER_ARTIFACTS.md §6.2, then strict-flip phases with fresh measurements.

## Open questions
- Strict-flip phase 1 at ~1,166 errors: do it as one mega-phase or split TS7006 (mechanically annotatable) from the rest? Decide at phase start.
- getCoordinatorAgents export gap (flagged by head-1, dormant double-flag-gated) — deferred-cut/scoping track, not a burn blocker.

## Deferred-cut tail (for wrap-up)
- attributionTrailer at src/shared/utils/attribution.ts (b0251-area) + ink-app twin — re-attempt after those batches burn.
- Reminder rendering cases b0091/b0060-area.
- getCoordinatorAgents not exported by coordinator/workerAgent.js (b0395 find).
- S5/SDK-dist CI item — externally gated, not started.
