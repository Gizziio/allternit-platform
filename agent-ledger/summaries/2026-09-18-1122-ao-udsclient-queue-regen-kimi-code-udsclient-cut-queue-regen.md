# 2026-09-18 1122 ao/udsclient-queue-regen — dead udsClient cut + burn-down queue regen (kimi-code)

Branch: `ao/udsclient-queue-regen` (worktree `allternit-ao-udsclient`). PR **#593**, merge commit **6a08be01878ffc70c7d812a2c8dbdd1f7e8db3dc** (merge --merge onto e30330713).

## What was done

Owner decision from shim-triage: the deferred `udsClient.ts` deletion ships now, plus the queue.json follow-up regen shim-triage explicitly deferred.

**Commit 1 `c26a5e935` — fix(gizzi-code): remove dead udsClient dynamic import and delete the module**
- `cmd/gizzi-code/src/cli/ui/ink-app/utils/conversationRecovery.ts` (`loadConversationForResume`, `--continue` branch): removed the `BG_SESSIONS`-gated `await import('./udsClient.js')` block entirely. It was dead-at-runtime — its re-export target `src/shared/utils/udsClient.js` is already deleted, so the import always threw into its catch and the live-session skip set was always empty. Fallback behavior preserved explicitly: the empty-skip `logs.find(...)` reduced to `log = logs[0] ?? null` (most recent session). `feature` import retained (still used by KAIROS gates); `getSessionIdFromLog` still used at line ~525.
- `git rm src/cli/ui/ink-app/utils/udsClient.ts`; zero `udsClient` references remain in `src/` (grep-verified; comment wording avoids the literal token).
- Appended `src/cli/ui/ink-app/utils/udsClient.ts` to `cmd/gizzi-code/test/deleted-paths.txt` (format: one repo-relative path per line, trailing LF — matches).

**Commit 2 `58c8a9007` — chore(gizzi-code): regenerate ts-nocheck burn-down queue**
- `node script/typecheck-burndown/build-queue.mjs`.
- Quarantine **34 → 25**: `suspect-malformed` 14 → 6 (the 8 PR-592 grammar-fixed files now parse → moved into the burnable queue, batch `b0002`), `suspect-dead-shim` 20 → 19 (`udsClient.ts` gone). 25, not the estimated 26, because the estimate assumed `udsClient.ts` still counted — with it deleted it cannot. All 8 PR-592 files verified absent from quarantine (they are now active queue files, not quarantined).
- Builder bug (handled, not stopped): retired DONE-batch records carry forward **verbatim** (`{...old}`), so `b0001.escalated` still listed the 3 PR-589-deleted paths + `udsClient.ts`. Pruned those 4 stale escalated entries in the regenerated file. No information loss: PR-589's own commit record, `deleted-paths.txt`, and (for the 12 still-malformed shims) the live `quarantined[]` section all carry the information; the 8 PR-592-fixed files stay in `b0001.escalated` as burn history. From the pruned committed state, regen is idempotent (carry-forward verbatim of the pruned record).
- `b0001` stays DONE, `burnedFiles: 226` / `burnedLoc: 6823` intact. `stats.totalAccounted` identity: 1526 kept + 25 quarantined + 226 burned = 1777 (was 1778; −1 = deleted `udsClient.ts`).
- No active batch lost files: all 1518 previously-active files still queued (1526 = +8 fixed files). Two consecutive regen runs byte-identical (deterministic; `generatedFrom` pins worktree HEAD, unchanged between runs).

## Verification evidence (worktree, origin/main @ e30330713)

- `bash script/ensure-sdk-dist.sh && NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` → **exit 0**
- `bun run test` (ci-smoke-test.sh) → **1311 pass / 0 fail**, 42 skip, 107/107 entries green
- `bun test test/ts-nocheck-guard.test.ts` → 5/5 (queue consistency, nocheck ratchet, header check, no-untracked-burns identity, quarantine stable-or-shrinking + disjoint)
- `bun test test/dead-code-guard.test.ts` → 4/4 (incl. new udsClient manifest entry: no on-disk restore, no dangling imports)
- `node scripts/release-preflight.mjs` → **52 passed, 0 failed**
- `npx eslint conversationRecovery.ts` → 1 error (`@ts-nocheck` ban) — identical problem-for-problem to `origin/main` baseline; zero new problems

## Incidents / notes

- `pnpm install` in the fresh worktree re-resolved peer deps and dirty-modified root `pnpm-lock.yaml` (@babel/core 8.0.1 ts-jest peer contexts, +124/−14). Environment-induced, out of scope → `git checkout -- pnpm-lock.yaml` reverted it; node_modules state is unaffected for test purposes.
- Scope discipline: only conversationRecovery.ts, udsClient.ts, queue.json, deleted-paths.txt touched. Release-path files untouched.

## Deferred

- Desktop rebuild (step 8): session touched only gizzi-code TUI util + metadata — nothing the desktop bundles differently; rebuild skipped per the skip rule.
- Remaining 12 b0001 escalations (still-malformed TEMPORARY SHIM stubs) still need the dedicated behavior-change-approval cleanup pass — unchanged from shim triage.
