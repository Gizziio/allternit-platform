# ts burn-down batch b0005 — 2026-09-18 1253

- **Session:** ao/ts-burn-b0005 (kimi-code, agent-49)
- **PR:** #605, merged `931ea4189` (merge commit on main)
- **Scope:** batch b0005 of the gizzi-code `@ts-nocheck` burn-down — one file: `cmd/gizzi-code/src/cli/ui/ink-app/utils/Cursor.ts` (1,531 LOC; Cursor/MeasuredText/WrappedLine kill-ring + grapheme-aware text measurement)

## What was done

1. Worktree `allternit-ao-tsburn-b0005` on `ao/ts-burn-b0005` from `origin/main` (6a3ad035f). pnpm install, `ensure-sdk-dist.sh` (rebuilt os-contracts dist — the hardened sidecar logic from PR #604 self-healed the fresh worktree exactly as designed).
2. Baseline `tsc --noEmit -p tsconfig.typecheck.json`: exit 0, cold 18.1s.
3. Stripped the `@ts-nocheck` header. First removal tsc run: **0 errors** (21.7s). The file was already fully type-clean under the real types from the fixed `src/types/*.d.ts` shadows — no annotations, casts, or narrowing needed. Diff is exactly one line.
4. queue.json: b0005 → DONE (`burnedFiles: 1`, `burnedLoc: 1531`, `escalated: []`, file list emptied per the b0004 DONE-entry schema). stats: totalNocheck 1840→1839, totalQueueFiles 1365→1364, totalQueueLoc 471644→470113. `totalAccounted` untouched (1475).

## Verification

- `npx tsc --noEmit -p tsconfig.typecheck.json` exit 0 (cold 18.1s / warm 21.7s)
- `bun run test` smoke: **1311 pass / 42 skip / 0 fail** across 107 files; ts-nocheck guard 5/5 green (count not grown, queued files carry headers, identity reconciles: live + recorded burns == 1475, quarantine disjoint)
- `npx eslint src/cli/ui/ink-app/utils/Cursor.ts` — clean, zero new disables
- `node scripts/release-preflight.mjs` — 52 passed / 0 failed
- Diff self-audit: header removal + queue.json batch entry only; zero runtime-logic, import-target, or reformatting changes

## Incidents / notes

- First smoke run showed 3 guard failures — self-inflicted race: the suite was launched before the queue.json batch-entry edits landed, so the guard correctly flagged "queued file lost its header without queue update". Re-ran after the edits: guard 5/5. Second re-run had one unrelated flaky failure (not the guard, name lost to tail-only logging); the final captured full-log run is 1311/0 with exit 0.
- A concurrent session's attestation commit (`ao/ensure-sdk-dist-harden`, 2582f3fc0) landed on local main mid-session; it was pushed by that session and the shared checkout fast-forwarded past it — git-discipline PASS at 2582f3fc0.
- origin/main moved (e0a8dce2b) after branching; no file overlap with this batch, merge was clean.

## Deferred

- None. No latent-runtime-bug escalations this batch.
