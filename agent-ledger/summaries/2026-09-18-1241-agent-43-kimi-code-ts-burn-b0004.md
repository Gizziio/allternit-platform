# ts-nocheck burn-down batch b0004 — agent-43 (kimi-code)

- **Date:** 2026-09-18 ~12:41 CDT
- **Branch:** `ao/ts-burn-b0004` → **PR #601** → merge commit `3cdfa1eec` (merge --merge)
- **Scope:** `cmd/gizzi-code/script/typecheck-burndown/queue.json` batch b0004 — 67 files, 7,106 LOC, all under `src/cli/ui/ink-app/` (plus 8 runtime/shared files)

## What was done

Burned all 67 of b0004's queued `// @ts-nocheck` files — **zero escalations** (0% of batch).

- 54 files compiled clean after header removal.
- 13 files needed type-only fixes; all are annotations, local mirror types, `as` casts with `// TODO(types)` cop-out markers, or narrowing. Zero runtime-logic changes, zero import-specifier target changes, no `src/types/*.d.ts` edits.

Notable fixes:

- **keybindings/types.ts is an unimplemented stub OUTSIDE the batch** — `ParsedKeystroke`/`ParsedBinding`/`KeybindingContextName` mirrors were placed inside the batch files (`match.ts`, `useShortcutDisplay.ts`) after an out-of-batch edit was caught in the diff self-audit and reverted.
- **global.d.ts landmine class:** `lodash-es/memoize.js` ambient shadow returns plain `T` (no `.cache`) — local `MemoizedGitCheck` mirror in `gitAvailability.ts`. Still required after the #599 purge because `@allternit/gizzi-util` ships no type declarations (same reason for the `NamedErrorObject` mirror in `runtime/session/retry.ts`).
- **Same vault-cron-job class as b0003** (`CronJob` union omits `VaultJob` though the daemon registers vault jobs): `switch (job.type as JobType)` + `agentQueue: undefined` in `service-enhanced.ts` — the established b0003 idiom.
- **Mis-annotations corrected in sandbox-adapter.ts:** `SandboxRuntimeConfig.ignoreViolations` `string[]` → `IgnoreViolationsConfig` (zod schemas confirm `Record<string,string[]>`); `getAllowUnixSockets()` `string[] | undefined` → `boolean | undefined` (runtime value is the settings boolean; `ISandboxManager`, global.d.ts, and both callers agree). Removed a redundant bottom `export type {...}` block (TS2484 x9 — type-only, erased at runtime).
- **Preserved-as-is runtime oddity:** `TestingPermissionTool.isEnabled()` returns `"production" === 'test'` (always false — looks like a stale bundler substitution of `process.env.NODE_ENV`). Kept byte-semantics with a type-only cast; flagged in the PR body, not escalated (testing-only tool, no evidence of user impact).

## Metrics

- Errors at first removal: **36 across 14 files** (TS2484 x9, TS2694 x5, TS2339 x5, TS2322 x4, TS2614 x3, TS2677 x2, TS2820/TS2749/TS2740/TS2678/TS2367/TS2353/TS2345/TS2305 x1 each)
- tsc iterations to convergence: 4 (incremental ~16–40s each; cold baseline 22.2s)
- Re-verified **exit 0 after rebasing** onto the landed react.d.ts (#600) / global.d.ts (#599) fix passes — real React 19 types + purged ambient shadows did not break any b0004 fix.

## queue.json handling

- b0004 → `DONE` (`burnedFiles: 67`, `burnedLoc: 7106`, `escalated: []`); burned files removed from the batch list per the guard contract.
- stats: totalNocheck 1907→1840, totalQueueFiles 1432→1365, totalQueueLoc 478750→471644. **totalAccounted pinned at 1475** — never touched.
- Guard identity after merge: live scan 1388 (incl. 21 quarantined) + 89 recorded burns (b0003 20 + historical b0002 2 from #599 + this 67) = 1475.
- **Concurrent-merge care:** main gained a historical b0002 DONE record (+2 burns, ansi-tokenize twins) and duplicate b0002 IDs while this batch ran; the rebased queue.json was rebuilt as origin/main's version + only the b0004 delta (a `--theirs`/`--ours` mix-up during conflict resolution was caught and corrected before push — main's entries verified preserved).

## Verification evidence

- `npx tsc --noEmit -p tsconfig.typecheck.json`: exit 0 (post-rebase tree)
- `bun run test`: SMOKE PASS — 1311 pass / 0 fail / 42 skip across 107 files; guard test 5/5 (no count growth, burn identity, quarantine disjointness)
- `npx eslint <changed files>`: 11 errors / 17 warnings vs 18 / 16 on the same files at merge base — strictly fewer, zero new errors, zero new disables
- `node scripts/release-preflight.mjs`: 52 passed, 0 failed
- pnpm-lock.yaml install churn (peer-dep re-resolution across foreign importers) reverted pre-commit per the b0003 pattern
- `scripts/git-discipline-check.sh`: **PASS** — on main == origin/main (b4de9ca40), worktree clean

## Incidents / honest notes

- Mid-rebase conflict resolution initially staged the wrong side for queue.json (`--theirs` during rebase = own patch); caught by asserting main's new entries, rebuilt correctly, all gates re-run on the final tree before push.
- Diff self-audit caught one out-of-batch edit (`keybindings/types.ts`) before commit; reverted to stay strictly within batch boundaries.
- No latent-runtime-bug escalations this batch. The `TestingPermissionTool.isEnabled()` always-false comparison is recorded above as a follow-up candidate for a runtime owner.

## Deferred

- `keybindings/types.ts` remains an unimplemented stub (tracked by the keybindings-migration TODOs); when it lands real types, the local mirrors in `match.ts`/`useShortcutDisplay.ts` should be deleted.
- `CronJob` union should gain `VaultJob` (both service.ts and service-enhanced.ts carry the same TODO(types) cast until then).
- `utils/attachments.ts` `Attachment['type']` union omits `pen_mode_enter`/`pen_mode_exit` — the nullRenderingAttachments satisfies-guard was widened with an explicit TODO(types) cop-out.
