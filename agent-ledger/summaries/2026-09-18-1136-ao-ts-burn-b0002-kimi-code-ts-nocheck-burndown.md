# Attestation: ts burn-down batch b0002 (first production lane)

**Session:** ao/ts-burn-b0002 (worktree `allternit-ao-tsburn-b0002`, branch `ao/ts-burn-b0002`)
**Agent:** kimi-code subagent | **Date:** 2026-09-18 | **PR:** #596 | **Merge SHA:** 7faf845562cff791dcf7ffae995c0e087f42e9c2

## What was done

Burned `// @ts-nocheck` from 68 of b0002's original 70 queued files (6,743 LOC; queue batch b0002 marked DONE). All newly-visible type errors fixed type-onlyly: 57 files were pure header removals; 11 needed annotation-class fixes only (local mirror interfaces for dead TEMPORARY SHIM type files with `TODO(types)` markers, intersection annotations for types owned by other batches' files, marked `as` casts for ambient-declaration gaps, one dead `export type` elision, one excess-argument removal that JS ignores at runtime).

## Metrics

- 26 errors at first removal across 15 files: TS2614 ×8, TS2339 ×7, TS2554 ×5, TS2353 ×2, TS2315 ×2, TS2345 ×1, TS2322 ×1
- 3 tsc iterations to convergence; cold baseline tsc ~20s, warm iterations ~15-20s (incremental)
- Wall: setup (worktree+pnpm install) ~2.5 min; total session ~26 min
- Escalated: 2 (headers restored) — the `sliceAnsi` twin pair (`src/cli/ui/ink-app/utils/sliceAnsi.ts`, `src/shared/utils/sliceAnsi.ts`), blocked by a bogus ambient `declare module '@alcalzone/ansi-tokenize'` in `src/types/global.d.ts` (real 0.2.5 types shadowed by 2-arg `reduceAnsiCodes` / non-discriminated `Token` fantasy shapes).

## Incidents / findings

1. **Mid-flight queue regen (58c8a9007)** landed while working: shim-triage moved 7 grammar-fixed ex-b0001 files INTO b0002 and `question.ts` OUT. Rebased; queue.json reconciled against the new baseline (totalNocheck 2005→1937, totalQueueFiles 1526→1458, totalQueueLoc 492358→485615, totalAccounted pinned 1777). The 8 still-headered regen arrivals remain listed in b0002 for future batches.
2. **Latent runtime bug surfaced** (not fixed — outside type-only rule): `src/runtime/integrations/question/question.ts` imports the `Bus` class from `@/runtime/bus/bus` but calls static `Bus.publish`, which only exists on the `@/shared/bus` namespace → TypeError if `Question.ask/reply` executes. Header restored; owning batch must fix with behavior-change approval.
3. **Recurring structural finding**: dead TEMPORARY SHIM type files (no nocheck header, in no batch — keybindings/types.ts, Spinner/types.ts, secureStorage/types.ts, FeedbackSurvey/utils.ts, plugin/types.ts) plus ambient module decls in `src/types/global.d.ts` (ansi-tokenize, lodash-es/memoize.js, @modelcontextprotocol/sdk server ctor) are the burn-down's dominant friction source. Recommend a dedicated pass to correct `src/types/global.d.ts` and retire the dead shims; until then batches accumulate `TODO(types)` local mirrors.
4. **Stale branch debt**: `ao/cut-dormant-stubs` (3 unmerged commits) pre-dates the merged shim-triage work; surfaced in `.steering/checkpoint.md` for the owner.

## Verification evidence

- `npx tsc --noEmit` (default + `tsconfig.typecheck.json`): exit 0
- `bun run test` (cmd/gizzi-code): SMOKE PASS, 107 entries green, 0 fail (ts-nocheck guard included, all 5 guard tests pass)
- `npx eslint` on 68 changed files: 0 new errors, 0 new eslint-disable lines (1 pre-existing `no-namespace` error remains, one fewer than main)
- `node scripts/release-preflight.mjs`: 52 passed, 0 failed
- Guard identity: live 1483 + recorded burns 294 = 1777 = totalAccounted ✓
- git-discipline: `PASS git-discipline: on main == origin/main (7faf84556 ...)` (with `ao/cut-dormant-stubs` passed as intentional — see incident 4)

## Honest deferrals

- 2 escalations + 8 regen-arrived files remain for future work (listed in queue.json b0002 with reasons).
- `question.ts` runtime bug not fixed (behavior change, not type-only).
