# ts burn-down b0026 — session/prompt.ts (ao/ts-burn-next12)

**Date:** 2026-09-19 01:16
**Agent:** Kimi Code (burn-down batch agent, worktree `allternit-ao-ts-burn-next12`)
**PR:** #665, merged `fa0dd1259` (merge commit)

## What was done

Burned batch **b0026**: stripped the handwritten `// @ts-nocheck` header from
`cmd/gizzi-code/src/runtime/session/prompt.ts` (2,478 LOC — the session prompt
pipeline: prompt/loop/message assembly, MCP tool wrapping, subtask execution,
title generation) and fixed every resulting type error, type-only.

Multi-error burn: **11 genuine strip errors → 5 after iteration 1 → 0 after
iteration 2.** No escalations. No TS2322 probe was needed — the 11 real
errors themselves prove the file is in the compilation (probe protocol
applies to header-only 0-error burns).

### Fixes in prompt.ts

1. `submittedText` filter/map: `TextPart` casts — under `strict:false` the
   non-predicate `.filter()` does not narrow the discriminated union.
2. `Provider.resolveAuto` message mapping: removed an invalid type-predicate
   (TS2677 — predicate type not assignable to parameter type) in favor of a
   plain filter + `TextPart` cast.
3. Subtask `taskArgs`: added `run_in_background: false` — the TaskTool zod
   schema requires it (`.default(false)`); the call site awaits the result
   synchronously, so this is behavior-preserving.
4. MCP tool execute wrapper: annotated `ToolDedupe.execute` with the real MCP
   `CallToolResult` type (imported from `@modelcontextprotocol/sdk/types.js`)
   intersected with `{ metadata?: Record<string, unknown> }` — the field the
   runtime actually reads off tool results. Replaces `unknown`.
5. Resource content block: cast to its `{ uri; text?; blob?; mimeType? }`
   union shape (the SDK types it as a text|blob discriminated union that
   `strict:false` won't narrow).
6. `Truncate.modelContent` call: cast `result.content` to
   `Truncate.ModelContentItem[]` (weak-type/index-signature incompatibility
   between the real MCP content block union and the local wrapper type).
7. Title-gen `firstUserSystem`: read via `MessageV2.User` cast — same idiom
   as the cast already present two lines below.

### Plugin SDK contract (P2 precedent, commit d62592717)

The runtime triggers three hooks by name that the `@allternit/plugin` SDK
`Hooks` type did not declare: `experimental.chat.messages.transform` (prompt
loop, before the request), `chat.message` (after user-message assembly), and
`command.execute.before` (command path). Following the established P2
pattern, declared all three in `packages/plugin/src/index.ts` with the
payload shapes observed at the call sites, rebuilt the tracked dist
(`packages/plugin/dist/index.d.ts`), and extended
`test/plugin/hooks-contract.test.ts` to cover all eight declared
runtime hooks (three new round-trip cases). Type-only contract change — the
dispatch in `Plugin.trigger` was and remains string-based; no runtime
behavior change.

## Verification

- `tsc --noEmit` (gizzi-code): **0 errors** — baseline (pre-strip), iteration
  1 (11 errors), iteration 2 (5), iteration 3 (0), post-contract-test (0),
  and post-rebase onto fresh origin/main (0). Six runs total.
- Smoke (`bun run test` = ci-smoke-test.sh): **1332 pass / 42 skip / 0 fail**,
  111 entries green, ts-nocheck guard green. (First smoke run raced my
  queue.json mid-edit and showed 3 guard failures; re-run after the queue
  update was fully written: clean.)
- eslint on touched files: **zero new findings** — the 4 errors
  (ban-ts-comment, no-namespace, 2× no-case-declarations) and 6 warnings in
  prompt.ts are byte-identical at HEAD (verified by linting the HEAD copy).
- `scripts/release-preflight.mjs`: **52 passed, 0 failed**.
- `pnpm-lock.yaml` untouched; `src/types/*.d.ts` untouched; no forbidden
  paths touched (release-desktop.yml, desktop surface, voice, local-engine,
  build-production.js, build-queue.mjs, decompile-artifact.mjs).

## Queue state handling

- b0026: `NEW → DONE`, `burnedFiles: 1`, `burnedLoc: 2478`, `escalated: []`,
  full note recorded.
- Stats re-derived from the live tree **seeded from origin/main at rebase
  time** (one sibling landing, b0256/PR #664, had advanced the queue:
  totalNocheck 1268→1240). Final: `totalNocheck 1240→1239`,
  `totalQueueFiles 886→885`, `totalQueueLoc 339144→336666`,
  `totalAccounted` untouched at 1460.
- Guard identity verified post-rebase: live 905 + recorded 555 = 1460 =
  totalAccounted; quarantined (20) untouched and disjoint; no allowlist
  entries needed.
- `test/ts-nocheck-allowlist.txt` unchanged (no escalations).

## Incidents / notes

- Rebase onto origin/main hit the expected queue.json conflict (sibling
  b0256 landed first); resolved per protocol — seeded from main's queue,
  re-applied only my b0026 changes, re-derived stats, never touched
  totalAccounted/quarantined/other batches. In rebase ours/theirs are
  swapped; caught the initial `--theirs` mistake before committing the
  wrong side.
- First-attempt `git rebase --continue` needed `GIT_EDITOR=true` (no editor
  in the hook-shelled environment).

## Deferred

Nothing. Batch fully burned, gates green, PR merged, shared checkout
fast-forwarded.
