# ao/ts-burn-b0007 — @ts-nocheck burn-down batch b0007

- **Date:** 2026-09-18 1313
- **Agent:** kimi-code (subagent, batch runner)
- **Branch:** `ao/ts-burn-b0007` → PR #607 → merged `4328a7b7a` (merge commit)

## What was done

Burned the single file in burn-down batch b0007:

- `cmd/gizzi-code/src/cli/ui/ink-app/native-ts/yoga-layout/index.ts` (2,579 LOC) — pure-TypeScript port of yoga-layout (Meta's flexbox engine), matching the `yoga-layout/load` API surface used by the ink layout layer.

**Header-only burn.** Removing `// @ts-nocheck` produced **0 type errors** on the first post-strip `tsc` run — the file was already type-clean under the fixed `src/types` shadows (same pattern as b0005/b0006; later queue files appear pre-typed). No source edits were needed or made.

Honest-coverage check: a deliberate `const __burnProbe: string = 42` was appended to confirm tsc actually type-checks this file — it produced the expected TS2322 at line 2579 — then was reverted via `git checkout`, which also reverted the header strip; the strip was re-applied and re-verified.

## Verification evidence

- Baseline `npx tsc --noEmit -p tsconfig.typecheck.json`: exit 0, cold 22s (after `ensure-sdk-dist.sh` self-healed the computer-use + os-contracts dists, exit 0).
- Post-strip tsc: exit 0, 0 errors, 0 fix iterations, warm ~28s.
- `bun run test`: 1353 tests across 107 files, 0 fail, SMOKE PASS — including the `ts-nocheck-guard` suite (5/5): count shrank 1838→1837, every remaining queued file still carries the header, identity live 1383 + recorded burns 92 = 1475 = `stats.totalAccounted` (untouched), quarantine disjoint and stable.
- `npx eslint src/cli/ui/ink-app/native-ts/yoga-layout/index.ts`: exit 0.
- `node scripts/release-preflight.mjs`: 52 passed, 0 failed.
- Diff self-audit: exactly 2 files changed — the 1-line header deletion + `queue.json` (b0007 DONE entry + stats). `pnpm-lock.yaml` churn from install reverted pre-commit.

## queue.json handling

- b0007 entry marked DONE following b0006's shape exactly: `files: []`, `loc: 2579` kept, `state: "DONE"`, `burnedFiles: 1`, `burnedLoc: 2579`, `escalated: []`.
- `stats.totalNocheck` 1838→1837, `totalQueueFiles` 1363→1362, `totalQueueLoc` 468223→465644.
- `stats.totalAccounted` (1475) untouched; quarantined list untouched; no other batch entries touched.

## Incidents / escalations

None. No latent-runtime-bug findings (nothing but the header line changed). None of the accumulated landmines applied: no `reduceAnsiCodes` 2-arg call, no `TestingPermissionTool.isEnabled` literal, no `src/types/*.d.ts` edits, no forbidden-path edits.

## Deferred

Nothing. Gates: discipline PASS (on main == origin/main 4328a7b7a). Desktop rebuild N/A — nothing the desktop bundles changed (a typecheck-only header removal in an already-type-clean file).
