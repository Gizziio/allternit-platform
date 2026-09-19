# ao/queue-builder-fix — burn-down queue builder: safe full regen (2026-09-18, kimi-code)

## What was done

Fixed the `@ts-nocheck` burn-down queue builder
(`cmd/gizzi-code/script/typecheck-burndown/build-queue.mjs`) so a full regen is
safe, then ran one final regen to clear the drift batch agents had been working
around by hand since burn b0010.

**Root cause.** The builder only carried retired records forward when a batch's
files were all quarantined (or the record was already emptied). A DONE batch
whose record still listed live files — b0003, burned 20 of 21 with one
escalation left — was silently discarded on regen, dropping its `burnedFiles`
from `stats.totalAccounted`. Combined with out-of-band deletions (CUT lanes
removed ~20+ nocheck files outside burn tracking), a fresh regen computed a
total ~22 below the pinned 1475 and the guard identity
(live + recorded burns == totalAccounted) failed. Regen also renumbered every
active batch.

**Fix.**

1. Retirement gate generalized: retire when no file in the batch is still live
   (burned headers, quarantine, out-of-band deletions all count), and retire
   DONE batches unconditionally — record (`state`/`burnedFiles`/`burnedLoc`/
   `escalated`/`note`) carries forward with `files: []`; live remainders return
   to the pool and repack. (Zero-file records already carried verbatim —
   b0006-era behavior — verified.)
2. `totalAccounted` formula unchanged by design — kept + quarantined +
   sum(DONE `burnedFiles`) — now self-consistent by construction.
3. Stable batch IDs: byte-identical sorted file list reuses the previous ID;
   genuinely new batches continue after the highest ID ever used. No more
   whole-queue renumbering; unchanged batches keep their b-IDs.
4. Determinism preserved (byte-identical on re-run, verified with cmp).

**Regen on latest main** (absorbs burn b0018, merged mid-flight): identity
holds exactly at the pinned **1475** = 1120 live kept + 20 quarantined + 335
recorded burns; 17 retired DONE records (b0002–b0018) preserved verbatim;
`postCompactCleanup.ts` legitimately re-enters the queue (dead-shim imports
removed by the dormant-stub cuts on main); 85 active batches, unchanged ones
keep their IDs.

Guard test needed no changes — its identity formula already matched the fixed
derivation.

## Verification evidence

- `bun test test/ts-nocheck-guard.test.ts` — 5/5 (against the regenerated file)
- `bun run test` (cmd/gizzi-code ci-smoke) — 1353 tests, 0 fail, 107 files green
- `bash script/ensure-sdk-dist.sh && NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` — exit 0
- `node scripts/release-preflight.mjs` — 52 passed, 0 failed
- Regen determinism: `cmp` byte-identical across two consecutive runs
- All gates re-run after the final rebase onto origin/main (absorbing b0018 +
  runtime-packaging + lawlayer-packaging), not just before it.

## Incidents / notes

- b0018 (PR #636) merged while the worktree was active; absorbed via rebase +
  stash-conflict resolution (took origin/main's queue.json, re-ran regen).
  Rebased again immediately before merge (lawlayer-packaging #637 did not touch
  the burn-down tree).
- Process note: burn agents cited "drift 22 stable, live+recorded 1453" in the
  b0017/b0018 attestations — the ~1453 figure was the drifted identity this fix
  cleans up; the queue now reconciles at the true pinned 1475.

## Links

- PR #638 (merged 39f280ae0), branch `ao/queue-builder-fix`, commit c964a9b89
- Files: `cmd/gizzi-code/script/typecheck-burndown/build-queue.mjs`,
  `cmd/gizzi-code/script/typecheck-burndown/queue.json` (regenerated)
