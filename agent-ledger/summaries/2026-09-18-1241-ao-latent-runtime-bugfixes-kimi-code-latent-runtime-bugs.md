# ao/latent-runtime-bugfixes — two latent runtime bugs from the TS burn-down (owner-approved fix lane)

**Date:** 2026-09-18 (session ~1241)
**Agent:** kimi-code (subagent of the agent-orchestrator steering session)
**Branch:** `ao/latent-runtime-bugfixes` → **PR #602, merge `b4de9ca402a7d4eefe993ed0204058a40ce4efff`**
**Base:** `origin/main` @ 15168c913 (fresh fetch; rebased onto latest main before push — concurrent burn-down merges b0004/zod-fix landed around it)

## What was done

Owner approved a behavior-fix lane (2026-09-18) for two latent runtime bugs that the
type-only burn-down rule could not touch. Both live in `// @ts-nocheck` files, which is
why they were runtime failures instead of compile errors. Both `@ts-nocheck` headers stay
in place — the files are queued for future burn batches. `queue.json` untouched.

### Bug 1 — theme success logging never prints (escalated by burn batch b0003)

- **Root cause:** `cmd/gizzi-code/src/cli/commands/theme/index.ts` calls `log('success', …)`
  8 times (lines 447–573), but the runtime logger (`src/runtime/util/log.ts`) had no
  `'success'` entry in `LOG_LEVELS`. `shouldLog()` computed `undefined >= 1` → `false`, so
  every success message was silently swallowed.
- **Fix chosen: (a)** — add the level to the logger rather than retarget 8 call sites to
  `'info'`. Rationale: `LOG_LEVELS` has a natural slot (weight `1`, the info tier — visible
  at debug/info thresholds, suppressed at warn+, always below `silent`), `shouldLog` is a
  plain `>=` comparison so no ordering assumption breaks, nothing iterates the map, and the
  `cli/utils/log.ts` wrapper already had a `success()` helper conceptually. `'success'` was
  added to the `LogLevel` union in `src/runtime/util/log.ts` (weight 1) and the wrapper's
  `LogLevel` type in `src/cli/utils/log.ts` widened to match (type-only; the wrapper passes
  through at runtime). Output goes to `console.log` as `[SUCCESS]`, same as `info`.
- **Regression test:** `cmd/gizzi-code/test/runtime/util-log.test.ts` (3 cases: prints at
  default info level, suppressed at warn, setLogLevel/getLogLevel round-trip). The file
  deliberately carries no `@ts-nocheck` so it adds zero new eslint problems.

### Bug 2 — wrong Bus import in question integration (escalated by burn batch b0002)

- **Root cause:** `cmd/gizzi-code/src/runtime/integrations/question/question.ts` imported the
  `Bus` **class** from `@/runtime/bus/bus` (instance methods only: `on/off/emit/once`) and
  called static `Bus.publish(def, properties)` in `ask`/`reply`/`reject` — a TypeError on
  every question event. A `// TODO(runtime)` comment marked the deferred swap.
- **Semantic analysis (verified, NOT a mismatch):** the `Bus` **namespace** from
  `@/shared/bus` exports `publish<Definition extends BusEvent.Definition>(def, properties)`
  — exactly the call shape. All three call sites pass a `BusEvent.define(...)` result plus
  its zod-output properties, fire-and-forget. This is the established convention across the
  runtime (session/index.ts, processor.ts, background-task.ts — 170+ call sites). The
  namespace path also records replay history and re-emits on `GlobalBus` (the real event
  flow), vs. the class's untyped string channel. The returned Promise was and remains
  un-observed. **Fix: swap the import, delete the stale TODO, zero other changes.**

## Verification evidence

- `bash script/ensure-sdk-dist.sh` + `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` → exit 0
- `bun run test` smoke → **1311 pass / 42 skip / 0 fail across 107 files** (107 entries green)
- `bun test test/runtime/util-log.test.ts` → 3 pass / 0 fail
- `node scripts/release-preflight.mjs` (repo root) → **52 passed, 0 failed**
- `npx eslint` on all 4 changed files → no new problems (remaining errors are pre-existing
  patterns identical on origin/main: `@ts-nocheck`/namespace bans in question.ts, `require`
  in log.ts — all predate this change)

## Incidents / notes

- None. Worktree `allternit-ao-latentfix` removed after merge; branch deleted local+remote.

## Deferred / honest follow-ups

- `theme/index.ts` and `question.ts` `@ts-nocheck` headers remain — future burn-batch scope.
- No desktop rebuild needed (gizzi-code behavior fix is source-level; desktop bundles pick it
  up at the next release build).
