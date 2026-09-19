# ts burn-down b0143 — 23 files burned, 0 escalations (ao/ts-burn-next4)

Date: 2026-09-18 22:52
Agent: kimi-code (subagent batch runner)
PR: #649 merged 776074e88 (merge commit on origin/main)
Batch: b0143 → synthetic DONE record (absorbed codemod-pilot1 queue regen, see below)

## What was done

Burned 23 `@ts-nocheck` files (7,051 LOC queued) from `cmd/gizzi-code/src/cli/`:

- **18 header-only 0-error burns.** TS2322 probe (`const __tsNocheckBurnProbe: string = 0` appended per file, one tsc run, expect exactly one TS2322 per file) confirmed 18/18 in the compilation unit; probes reverted and files reset to pristine-minus-header (first revert left trailing-newline artifacts — caught in diff self-audit, fixed by re-stripping from `git show HEAD:` content).
- **5 type-only fixes**, all following in-repo precedent:
  - `ink-app/utils/secureStorage/index.ts` + `macOsKeychainStorage.ts`: `./types` is a dormant shim (`types_ts()`). Local mirrors of `src/shared/utils/secureStorage/types.ts` with the sibling `TODO(types)` comment pattern already used by `fallbackStorage.ts`/`plainTextStorage.ts`.
  - `ink-app/services/lsp/LSPServerInstance.ts`: same dormant-shim pattern, local mirror of `src/runtime/services/lsp/types.ts`; `ScopedLspServerConfig` extended with the ink-app-only fields validated by `LspServerConfigSchema` in `utils/plugins/schemas.ts` (`initializationOptions`, `settings`, `workspaceFolder`, `startupTimeout`, `shutdownTimeout`, `restartOnCrash`, `maxRestarts`) — required by the runtime field-validation throws in `createLSPServerInstance`.
  - `ink-app/utils/proxy.ts`: lodash memoize `.cache` access → `(getProxyAgent as unknown as { cache: { clear?: () => void } })` (precedent: `utils/debug.ts:70`, `utils/caCerts.ts:113`).
  - `ink-app/utils/imagePaste.ts` (2 sites): ambient `image-processor-napi` declaration in `src/types/global.d.ts` lacks `getNativeModule` → `as unknown as` cast with `TODO(types)` comment (precedent: `tools/FileReadTool/imageProcessor.ts:47`). `src/types/*.d.ts` NOT edited (rule).

No runtime behavior changes. No escalations (latent-runtime-bug scan clean: the keychain storage mirror and LSP config mirror are pure type shapes; the `satisfies SecureStorage` object was not altered).

## Iteration histogram

- baseline tsc: 0 errors
- iter1 (strip 23 headers): 8 errors / 5 files (2× TS2614 dormant-shim imports, 2× TS2339 `getNativeModule`, 1× TS2339 memoize `.cache`)
- iter2: 10 errors / 1 file (LSP mirror missing 6 ink-app config fields)
- iter3: **0 errors** — converged in 3 iterations
- TS2322 probe run: 18/18, reverted

## Concurrent-regen absorb (the notable part of this batch)

While the batch ran, `ao/artifact-codemod-pilot1` (PR #647) merged: it de-compiled 29 React Compiler artifacts (`excludedCompilerArtifacts` 360→331, `totalNocheck` 1498→1469) and **regenerated queue.json**, remixing all batch contents and renumbering (my b0143's 23 files landed in b0180 ×19 and b0181 ×4; the b0142 escalations filesystem.ts/cowork.service.ts were re-queued live, which is correct — their headers are restored).

Rebase conflict on queue.json resolved per the established absorb pattern: take origin/main's regenerated queue as base, remove the 23 burned files from b0180/b0181, append a synthetic DONE `b0143` record (`burnedFiles: 23`, `burnedLoc: 7051` — the loc the files carried into the regen), decrement stats (`totalNocheck` 1469→1446, `totalQueueFiles` 1025→1002, `totalQueueLoc` 383145→376094), `batchCount` 103→104. Identity exact: live 1022 + recorded 451 + quarantined 20 = 1473 = totalAccounted (unchanged).

First absorb attempt double-decremented stats because `git checkout --theirs` during a rebase picks up the *rebased commit's* side (mine), not the base — re-done from `git checkout origin/main --` and verified against origin/main's stats block.

## Gates (all on the post-rebase tree)

- `tsc --noEmit` (cmd/gizzi-code): 0 errors — baseline, post-strip iterations, post-queue-update, and post-rebase
- `bash script/ci-smoke-test.sh`: PASS, 0 fail, 1353 tests (burn-down guard 5/5; guard failed 2/5 before stats.totalNocheck was decremented — expected sequencing, the guard is doing its job)
- eslint on the 23 files, same-environment A/B (HEAD content vs branch content, both linted with the worktree's node_modules): 36 → 14 problems, **zero new**. Note: the shared main checkout has a stale hoisted `@typescript-eslint/parser` (8.70.0 vs lockfile-pinned nested 8.58.2) which masks `preserve-caught-error`; same-env comparison is the only valid one. Net −23 ban-ts-comment errors.
- `node scripts/release-preflight.mjs`: 52 passed, 0 failed
- Release-touching files: none touched (run-only preflight per playbook)
- pnpm-lock.yaml: untouched

## Queue state after

- b0143: DONE (synthetic post-regen record), 0 escalations
- stats: totalNocheck 1446, totalQueueFiles 1002, totalQueueLoc 376094, totalAccounted 1473 (drift zero)
- quarantined: 20, untouched, disjoint
- Next NEW batch in queue order: b0020

## Verification evidence

- git-discipline: `PASS git-discipline: on main == origin/main (776074e88 ...)` — worktree clean, unmerged branches all live-worktree/allowlisted
- Wall time: ~55 min total (install 1 min, baseline tsc 16 s, 3 tsc iterations ~13 s each, probe 16 s, smoke 42 s ×3 runs, preflight instant; the bulk was eslint environment forensics + regen absorb)

## Deferred / follow-ups

- The two dormant shims (`ink-app/utils/secureStorage/types.ts`, `ink-app/services/lsp/types.ts`) still export nothing and are now mirrored in 3+ files each; whichever batch owns them should either grow the real exports or quarantine them — the TODO(types) comments name the removal condition.
- Main checkout's hoisted `@typescript-eslint/parser@8.70.0` predates the current lockfile (nested 8.58.2/8.59.2); a fresh `pnpm install` there would align it. Same-env eslint comparison avoids the skew for burn batches.
- Desktop rebuild (session lifecycle step 8) skipped per burn-batch precedent: no desktop-bundled surface changed.
