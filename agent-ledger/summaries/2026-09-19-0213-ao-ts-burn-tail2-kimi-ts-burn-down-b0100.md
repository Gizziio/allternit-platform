# ts burn-down b0100 (ao/ts-burn-tail2)

- **Date:** 2026-09-19 ~02:13 local
- **Agent:** kimi-code burn-down batch agent (tail lane)
- **PR:** #674 — merge SHA `7c06b7999` (`feat(gizzi-code): ts burn-down b0100`)
- **Batch:** `b0100` — 1 file, 1553 loc: `cmd/gizzi-code/src/shared/utils/swarm/inProcessRunner.ts`

## What was done

Stripped the `// @ts-nocheck` header from the shared in-process teammate runner and fixed the 4 type errors that surfaced, in 2 convergence iterations (4 → 1 → 0).

## Root cause

The shared copy imported `Tool` from `@/Tool.js`, which re-exports the **runtime namespace** `Tool` (`src/runtime/tools/builtins/tool.ts` — no type alias, only `export namespace Tool`), so `tool as Tool` failed TS2709 at three sites. Its runtime `ToolUseContext` (from the same entry) is also missing `updateFileHistoryState`/`updateAttributionState` vs the ink-app `ToolUseContext` that `@/services/compact/compact.js` (ink-app first in the tsconfig paths array) requires — TS2345/TS2739 at the `compactConversation` call.

## Fix (type-only)

- `Tool` now imported from `../../../cli/ui/ink-app/Tool.js` (the real type; same module the ink-app twin of this file uses, and the type `ToolUseConfirm.tool` expects).
- `ToolUseContext as InkToolUseContext` imported from the same module; `isolatedContext` cast to it at the two `compactConversation` argument sites. Widening the config field instead was rejected because the typed caller `InProcessBackend` holds a runtime-typed context and would have broken.
- Runtime `ToolUseContext` import kept for all other uses. No runtime behavior changed; no escalations; no allowlist changes.

## Queue state

- `b0100` → DONE (`burnedFiles: 1`, `burnedLoc: 1553`, note recorded).
- `stats.totalQueueFiles` 768 → 767, `stats.totalNocheck` 1062 → 1061 (per-burn decrements, the convention next16/next17 established). `totalAccounted` untouched (1460).
- Queue.json was seeded from the then-current `origin/main` twice — two sibling merges (next16/b0337 via PR #672, next17/b0366 via PR #673) landed mid-flight and were absorbed by rebasing; no collision on b0100.
- Guard identity after burn: live 787 + recorded 673 = 1460 = totalAccounted.

## Verification evidence

- `tsc --noEmit` (cmd/gizzi-code): 0 errors (baseline before strip: 0)
- `bash script/ci-smoke-test.sh`: 1332 pass / 42 skip / 0 fail — includes ts-nocheck burn-down guard 5/5
- eslint on the changed file: 0 findings
- `node scripts/release-preflight.mjs` (repo root): 52 passed, 0 failed
- Diff: 1 file, +7/−4, type-only
- This burn required real type fixes (not header-only), so no TS2322 probe was needed.
- git-discipline: `PASS git-discipline: on main == origin/main (7c06b7999 ...)`

## Wall time

~17 min total (install 1 min, baseline tsc 18 s, strip+2 fix iterations ~3 × 20 s, gates ~3 min, queue reseeds/rebases ~4 min for two mid-flight sibling merges).

## Follow-ups

- The ink-app twin `cmd/gizzi-code/src/cli/ui/ink-app/utils/swarm/inProcessRunner.ts` still carries `// @ts-nocheck` and remains queued in another batch.
- The runtime namespace-`Tool` chain (`src/runtime/tools/builtins/tool.ts` exporting only a namespace, re-exported through `src/runtime/tools/Tool.ts` and `src/Tool.ts`) is a trap for future burns; worth a cleanup pass outside the burn-down.
