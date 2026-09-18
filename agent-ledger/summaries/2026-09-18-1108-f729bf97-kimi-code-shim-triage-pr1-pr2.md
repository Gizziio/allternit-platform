# Shim triage PR-1 + PR-2 (no-owner-input half) — session f729bf97

**Date:** 2026-09-18 11:08 local · **Agent:** kimi-code · **Branches:** `ao/shim-triage-1`, `ao/shim-triage-2` · **Worktrees:** `allternit-ao-shimtriage1`, `allternit-ao-shimtriage2` (both removed after merge)

## What was done

Executed the two no-owner-input PRs of the shim-triage plan on top of the b0001 burn-down (PR #586) and queue-hardening (PR #591) work.

### PR-1 — pure deletions (PR #589, merge `254a6f9b6`, commit `602109d0f`)

Deleted 3 verified-dead `@ts-nocheck` re-export shims (re-verified zero importers on origin/main before acting; dynamic imports included in the search):

- `cmd/gizzi-code/src/runtime/components/Markdown.ts` — casing-mismatch re-export (TS1261); live consumers all import `ink-app/components/Markdown` directly.
- `cmd/gizzi-code/src/cli/ui/utils/permissions/PermissionUpdateSchema.ts` — wrong-path shim (`./ink-app/...`); every importer resolves to the live ink-app copy.
- `cmd/gizzi-code/src/cli/ui/utils/settings/settings.ts` — same wrong-path shim.

Empty dirs `src/runtime/components/`, `src/cli/ui/utils/` removed (verified empty). Collateral: repointed the stale UDS-client row in `docs/programs/rails/RAILS_PRODUCT_UPDATE_SYSTEM_PROMPT.md:132` at `commrails/src/peer/socket.rs`; appended the 3 paths to `cmd/gizzi-code/test/deleted-paths.txt`; hand-edited `queue.json` (schema at branch time: `version/generatedFrom/batchCount/stats/batches`, no `quarantined` — hardening PR had NOT landed) removing the 3 from `b0001.files`/`b0001.escalated` and updating stats (totalQueueFiles 1555→1552, totalNocheck 2009→2006, totalQueueLoc −8, b0001.loc 241→233) + note refresh; regenerated `script/ts-nocheck-baseline.txt` (count 2235→2007 — exactly 3 attributable to this PR; verified the origin/main tree greps 2010 pre-deletion; the other 225 lines of diff were pre-existing baseline staleness from the b0001 burn-down, picked up by the mandated regen).

**STOPPED per plan (re-verification contradiction):** `src/cli/ui/ink-app/utils/udsClient.ts` was NOT deleted. The triage plan claimed zero importers; re-verification found a live dynamic importer — `conversationRecovery.ts:495` (`await import('./udsClient.js')`, `BG_SESSIONS`-gated, try/catch). The import is dead at runtime today (the module re-exports from the already-deleted `src/shared/utils/udsClient.js`, so it always throws into the catch), but deleting the file would leave a dangling dynamic import in a keep-file and `test/dead-code-guard.test.ts`'s DYNAMIC_RE would reject the path in `deleted-paths.txt`. Left in queue.json/baseline; deferred to the owner-decision pass (PR-3).

### PR-2 — grammar repair of keep-as-stub files (PR #592, merge `8d784191a`, commit `58954efb3`)

8 files stay `@ts-nocheck`'d, feature-flag-gated TEMPORARY SHIMs; fixed only malformed grammar (brace-close, stub/no-op semantics preserved exactly) + 2 export additions matched to their consumers' call shapes (`logMemoryRecallShape` for `findRelevantMemories.ts:69-72` under `MEMORY_SHAPE_TELEMETRY`; `killMonitorMcpTasksForAgent` for `AgentTool/runAgent.ts:852-858` under `MONITOR_TOOL`). Notable: `localSearch.ts` was net −2 braces in the original (7 unclosed functions vs 5 usable trailing braces) — 2 stray trailing braces deleted. Branched from PR-1's merge, then fast-forwarded onto current origin/main (picked up relay-cut #590 and queue-hardening #591 mid-flight) and re-gated on the merged state.

**Queue-hardening interaction:** #591 landed between PR-1 and PR-2 and regenerated queue.json with a `quarantined[]` section listing all 8 PR-2 files as `suspect-malformed` — and revived stale `escalated` entries for PR-1's 3 deleted files (escalated is not existence-checked; guard-neutral). The new guard's quarantine invariant is stable-or-shrinking (live ⊆ committed), so PR-2's grammar fixes pass as-is; both the stale quarantine reasons and revived escalated entries were deliberately left for a follow-up queue regen to keep PR-2 grammar-only.

## Verification evidence

- PR-1: `ensure-sdk-dist` OK · `tsc --noEmit` exit 0 · `bun test` smoke 1309 pass/0 fail (107 entries) · guards 7/7 · `release-preflight` 52/0.
- PR-2: esbuild parse check 8/8 fixed files parse, all 8 origin/main originals FAIL the same check (method teeth proven) · `tsc --noEmit` exit 0 (both pre- and post-ff-merge) · eslint on the 8 files: identical 9 problems vs origin/main versions (8 pre-existing `ban-ts-comment` + 1 pre-existing unused-arg warning), zero new · guards 9/9 incl. #591's new quarantine invariants · smoke SMOKE PASS 1311 pass/0 fail on merged state · `release-preflight` 52/0.
- Smoke flake note: one earlier PR-2 smoke run failed on an unrelated 30s-timeout test (`reply - always persists approval and resolves` — touches none of the 8 files); passed on re-run and on the final merged-state run. The environment-sensitive `test/skill/skill.test.ts` (not in smoke.txt) fails standalone on clean base too.

## Incidents / honest deferrals

- **udsClient.ts deletion deferred** (live dynamic importer; owner decision needed on whether to also touch `conversationRecovery.ts`).
- **queue.json follow-up regen needed** after PR-2: prune the 8 fixed files from `quarantined` (34→26), refresh `suspect-malformed` reasons, and re-prune the 3 PR-1-deleted paths from `escalated` (revived by #591's regen). Guard-neutral today; metadata accuracy only.
- PR-3 owner-decision items untouched per plan: `MonitorTool.ts`, `ReviewArtifactTool.ts`, `WorkflowTool.ts`, `udsMessaging.ts`, `WorkflowTool/constants.ts`, `udsClient.ts`.
- Desktop rebuild (lifecycle step 8) not run — neither PR touches anything the desktop bundles beyond gizzi-code source already covered by gates; Eoj may rebuild at the next desktop session.
