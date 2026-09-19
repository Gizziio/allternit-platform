# ao/cut-attribution-hooks-v2 — cut dormant attribution stubs + burn-queue reconciliation

**Session:** ao/cut-attribution-hooks-v2 (kimi-code subagent)
**Date:** 2026-09-18 21:37
**Merged:** PR #642, merge commit `97c6e730e` (merge --merge, two conventional commits `1151cf00e` + `5945839e0`)
**Worktree:** `../allternit-ao-attrcut` (teardown completed)

## What was done

Cut the dormant `attributionHooks` ink-app stub that a prior cut attempt STOPPED on because it
sat in active burn batch **b0102** — burning a file slated for deletion is wasted work, so the
orchestration decision was: remove from queue → cut → regen with the fixed builder. Executed
exactly that, widened by reconnaissance (the `COMMIT_ATTRIBUTION` flag spans 8 files).

### Cut (3 stub files, all verified zero live importers)

- `cmd/gizzi-code/src/cli/ui/ink-app/utils/attributionHooks.ts` (@ts-nocheck TEMPORARY SHIM,
  born 2026-07-26 mass import; getAttribution returns [], registerAttributionHooks no-op)
- `cmd/gizzi-code/src/cli/ui/ink-app/utils/postCommitAttribution.ts` (sibling never-implemented
  stub under the same flag — installPrepareCommitMsgHook no-op, runPostCommitAttribution returns
  {success:true}; only importer was the flag-gated dynamic import in worktree.ts)
- `cmd/gizzi-code/src/shared/utils/postCommitAttribution.ts` (stub twin, same verification)

### Consumer blocks removed

- `commands/clear/caches.ts` — flag-gated clearAttributionCaches dynamic import (+ now-unused
  feature() import)
- `services/compact/postCompactCleanup.ts` — flag-gated sweepFileContentCache dynamic import
  (+ now-unused feature() import)
- both `utils/worktree.ts` copies — flag-gated installPrepareCommitMsgHook block + its comment
  (+ now-unused feature() imports)
- stale attributionHooks mentions in hooks.ts (both copies) + hooks/hooksConfigManager.ts
  comments (grep-sweep cleanliness)

### Left in place (wider-flag findings, all consume the live commitAttribution engine, not stubs)

- `shell/bashProvider.ts` (both copies) — flag-gated heredoc debug logging
- `sessionRestore.ts` — flag-gated attribution snapshot restore (live commitAttribution helpers)
- `attribution.ts` (both copies) — flag-gated PR trailers; imports `attributionTrailer.js`, which
  is ITSELF a stub but has live importers — future-cut candidate, noted in PR + row 17
- `REPL.tsx:3813` — flag-gated incrementPromptCount on live attribution state
- `COMMIT_ATTRIBUTION` flag constant kept (compile-time bun:bundle feature, live refs remain)

### Docs

- Row 17 of `docs/programs/gizzi/DORMANT_STUB_DECISIONS.md` → **CUT (done, PR #616 + this cut)**;
  row 18's b0102 reference updated (repacked to b0141 by this regen)
- 3 deleted paths appended to `cmd/gizzi-code/test/deleted-paths.txt`

## Burn-queue handling

- b0102 hand-edited first (43→41 files, loc 6544→6504) — committed in the cut commit
- Regenerated with the fixed builder as a separate commit. Verification:
  - 18 DONE records preserved (zero-file history records, burnedFiles counts intact)
  - totalAccounted 1473 self-consistent — ts-nocheck guard accounting-identity test 5/5
  - neither stub anywhere in the queue; run-twice byte-identical
  - **b0102 id retired by builder design** (id reuse requires an identical sorted file list; a
    mid-batch edit of a NEW no-history batch retires it); its 41 remaining files repacked to
    **b0141** (85→83 NEW batches). No burn history lost. This matches builder mechanics — prior
    burn PRs showed no churn only because whole batch-aligned slices were removed.

## Verification evidence (all on rebased HEAD, post-merge-of-#641)

- `bash script/ensure-sdk-dist.sh && NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` → exit 0
- `bun run test` → 1311 pass / 0 fail / 42 skip; SMOKE PASS 107 entries; ts-nocheck guard 5/5 +
  dead-code/deleted-paths guard 4/4
- `node scripts/release-preflight.mjs` → 52 passed, 0 failed
- Rebase incident: concurrent PR #641 (orphaned-stub follow-ups) landed mid-flight touching
  deleted-paths.txt + DORMANT_STUB_DECISIONS.md — conflicts resolved keeping both lanes' rows
  (17 updated, 18-22 kept, row 18 batch ref corrected), queue.json applied clean (base identical)

## Honest deferrals

- `attributionTrailer.ts` stub NOT cut (live importers in attribution.ts/commitAttribution.ts) —
  needs the PR-trailer consumer decision first
- No desktop rebuild (step 8) — session touched nothing the desktop bundles beyond gizzi-code
  source; next desktop build picks it up
