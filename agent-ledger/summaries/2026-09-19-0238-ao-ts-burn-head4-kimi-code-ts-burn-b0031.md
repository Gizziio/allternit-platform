# ts burn-down b0031 — ao/ts-burn-head4

- **Date:** 2026-09-19 02:38
- **Agent:** Kimi Code (burn-down batch agent, head-of-queue selection)
- **PR:** #678, merged `aa9de1177` (merge commit), branch `ao/ts-burn-head4` (deleted)
- **Batch:** b0031 — 1 file, `src/runtime/context/config/config.ts` (1,886 queue LOC)

## What was done

Stripped the `// @ts-nocheck` header from the runtime config module and fixed
the 3 resulting type errors (converged in 1 iteration; 3→0):

1. `merge()` — remeda `mergeDeep`'s `MergeDeep<T,S>` mapped type collapses to
   `never` on the large `Info` zod v4 output type, so `merged.plugin` /
   `merged.instructions` assignments failed TS2339 (2 errors). Pinned via
   `as Info` — type-only, the mergeDeep result is Info-shaped by construction.
2. lsp schema `.refine()` callback — `if (config.disabled) return true` does
   not narrow the `{disabled: true} | {command, extensions?, ...}` union under
   `strict:false`, so `config.extensions` failed TS2339 on the
   `{disabled: true}` member (1 error). Pinned via cast to
   `{extensions?: string[]}`; that member is unreachable at that line
   (disabled:true returns two lines earlier), so no behavior change.

No escalations. No headers restored. No allowlist changes. `src/types/*.d.ts`
untouched. pnpm-lock untouched.

## Queue bookkeeping

b0031 marked DONE (burnedFiles 1, burnedLoc 1886). Mid-flight the
ao/artifact-codemod-pilot7 regen landed (PR #677), so the queue was re-seeded
from fresh `origin/main` at rebase per playbook conflict rules:

- totalNocheck 999 → 998 (my strip; pilot7's regen had already dropped it
  1032 → 999 by decompiling 33 compiler artifacts, excludedCompilerArtifacts
  181 → 148)
- totalQueueFiles 738 → 737, totalQueueLoc 300694 → 298808
- totalAccounted 1460 untouched; quarantine (20) and other batches untouched

Identity verified against live scan after rebase: live queue 757 + recorded
burns 703 = 1460 = totalAccounted. Guard test 5/5 post-rebase.

`ts-nocheck-baseline.txt` 1001 → 1000 via `--update` (config.ts removed).
Note: the update also locks in `shared/utils/gizzimd.ts`'s removal — that file
was burned by ao/ts-burn-tail3 (b0099, PR #676) whose PR omitted the baseline
update, leaving the committed baseline stale by one.

## Verification

- `tsc --noEmit`: 0 errors (baseline, post-strip-iterate, and post-rebase)
- smoke `ci-smoke-test.sh`: 1332 pass / 0 fail / 42 skip incl. burn-down guard
  (pre-rebase full run; guard test re-run 5/5 post-rebase)
- eslint on the changed file: zero new issues (2 errors / 3 warnings all
  pre-existing on lines untouched by this burn)
- `node scripts/release-preflight.mjs`: 52 passed, 0 failed

## Incidents

- First rebase attempt hit conflicts in `queue.json` +
  `ts-nocheck-baseline.txt` from the pilot7 regen landing mid-flight; resolved
  per playbook (seed from main, apply only my deltas, regenerate baseline from
  the live tree). A pre-rebase commit had already been pushed; force-with-lease
  updated the branch after all gates re-ran green on the rebased state.

## Deferrals

None. The codemod pilot work continues in its own track; next burn batch is
b0034 (`bashSecurity.ts`, head-of-queue).
