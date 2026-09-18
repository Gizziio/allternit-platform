# Attestation — ao/ts-burn-b0003 (@ts-nocheck burn-down)

- **Date:** 2026-09-18 1300
- **Session:** ao/ts-burn-b0003 (worktree `allternit-ao-tsburn-b0003`, branch `ao/ts-burn-b0003`)
- **Agent:** kimi-code (batch subagent)
- **PR:** #598 — merge commit `54084f6863d7e3db1f3cb132e3ca28dfb55aa8cd`

## What was done

Burned down batch **b0003** from `cmd/gizzi-code/script/typecheck-burndown/queue.json` (21 files / 7,011 LOC). 20 files had their `// @ts-nocheck` header removed and all newly-visible type errors fixed **type-onlyly**; 1 file escalated with its header restored byte-identical.

## How it works / key decisions

- **react ambient landmine (same class as b0002's ansi-tokenize):** `src/types/react.d.ts` permissive ambient `declare module 'react'` shadows real React types and omits `RefObject`, `useDeferredValue`, and the 3-arg `useReducer` initializer form. Worked around with local mirror types + `TODO(types)` markers in `useVirtualScroll.ts` and `use-select-navigation.ts`; `react.d.ts` and `src/types/global.d.ts` left untouched (owned by the dedicated fix pass).
- **`cron/service.ts`:** `DEFAULT_CONFIG` gained `agentQueue: undefined` (satisfies `Required<CronServiceConfig>`, runtime-equivalent — the `if (state.config.agentQueue)` check is unchanged); the job-type switch casts to `JobType` because the daemon registers `vault` jobs at runtime while the `CronJob` union has no `VaultJob` member (type gap, not a runtime bug).
- **`brain/service.ts`:** local `EntityType` union mirrors the `entity_type` `$type<>` on `MemoryEntityTable`; the `Entity` interface was widened to `string` at some point and no longer matched the schema.
- **Escalation (1 = 4.8% of batch, below the 30% stop threshold):** `src/cli/commands/theme/index.ts` — latent runtime bug: 8 × `log('success', …)` calls pass a level that does not exist in `LogLevel` (`'debug'|'info'|'warn'|'error'`, `'silent'` at runtime in `src/runtime/util/log.ts`); `LOG_LEVELS['success']` is `undefined`, so `shouldLog()` silently swallows every success message. Fixing needs a behavior change (add a `'success'` level or re-target the calls) — outside type-only scope. Recorded in queue.json `b0003.escalated` with reason `latent-runtime-bug: …`.
- **queue.json:** the 2026-09-18 collateral regen (`156fea64a`) had re-based `stats.totalAccounted` to 1475 and reset all batch states to NEW (dropping b0001/b0002's recorded `burnedFiles`), so only b0003's burn needed recording: `state: DONE`, `burnedFiles: 20`, `burnedLoc: 6428`, escalated list, burned files removed from the batch's `files` per the guard contract. stats: `totalNocheck` 1929→1909, `totalQueueFiles` 1454→1434, `totalQueueLoc` 485387→478939; `totalAccounted` pinned at 1475 — guard identity verified: live scan 1455 (1434 queued + 21 quarantined) + 20 recorded burns = 1475.

## Verification evidence

- Cold baseline `npx tsc --noEmit -p tsconfig.typecheck.json` exit 0 (51s).
- 3 tsc iterations: 15 errors at first removal (6 files) → 1 → 0. Warm iterations 10.5–40s; fresh-tsbuildinfo full check exit 0 (16s).
- Error histogram at first removal: TS2345×8, TS2769×2, TS2305×2, TS2741×1, TS2678×1, TS2554×1, TS2352×1.
- `bun run test` cmd/gizzi-code: **1311 pass / 0 fail**, `SMOKE PASS: 107 entries green` (guard included — the 3 guard tests correctly failed before the queue.json update and passed after).
- `npx eslint` on all 21 changed files: 0 new errors, 0 new disable lines; net error count strictly lower than main (the two remaining errors — `custom-rules/no-lookbehind-regex` definition in `heredoc.ts:70`, `no-namespace` in `brain.service.ts` — verified pre-existing on origin/main, and the `@ts-nocheck` `ban-ts-comment` errors on both files are gone).
- `node scripts/release-preflight.mjs`: **52 passed / 0 failed**.
- Diff self-audit: 19 header removals + 5 type-only files + queue.json; theme/index.ts net-zero (header restored byte-identical); no files outside the batch; `pnpm-lock.yaml` churn from install reverted before commit.
- `scripts/git-discipline-check.sh`: **PASS** (on main == origin/main @ 54084f686, worktree clean).

## Incidents / honest deferrals

- None blocking. The `react` ambient shadowing affects a large slice of ink-app (every `RefObject`/`useDeferredValue` importer is currently nocheck'd); the dedicated `src/types` fix pass should land soon or later batches will keep re-mirroring these three shapes.
- The theme `log('success')` escalation is a user-visible defect (success feedback never prints) awaiting an owning batch with behavior-change approval.
