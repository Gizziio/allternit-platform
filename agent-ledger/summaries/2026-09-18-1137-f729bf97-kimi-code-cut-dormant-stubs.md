# Cut four dormant never-implemented feature stubs from cmd/gizzi-code

- **Session:** ao/cut-dormant-stubs (PR #594, merge **f29499d4371e3537b5b9150c009aed80b98c84bb**)
- **Date:** 2026-09-18 11:37
- **Agent:** kimi-code (subagent)
- **Base:** main @ 17da5b5cb → rebased twice (onto 52486d9a3 after #592/#593, onto c501db505 after #595/#596) before merge

## What was done

Owner decision (2026-09-18): cut all four, following the superconductor/relay
precedent and the shim-triage PR-3 owner-decision list. Every cut was
re-verified before deleting: all four were born broken in the 2026-07-26 mass
import (2bda61382), never implemented anywhere in repo history, and every
importer was `feature('...')`-gated from `bun:bundle`; several stubs were
missing the exports their gated consumers destructured (enabling the flag
would TypeError). No contradictions — no live ungated importer existed.

Five commits (4 cuts + 1 collateral):

1. `chore(gizzi-code): cut dormant REVIEW_ARTIFACT stub and gated consumers`
   — deleted `tools/ReviewArtifactTool/` + `components/permissions/ReviewArtifactPermissionRequest/`,
   gated blocks in `PermissionRequest.tsx`, comment refs in `interactiveHandler.ts`.
   Confirmed never registered in `tools.ts`.
2. `chore(gizzi-code): cut dormant WorkflowScripts stubs and gated consumers`
   — deleted `tools/WorkflowTool/` (bundled/index.js + createWorkflowCommand.js
   never existed), `tasks/LocalWorkflowTask/` (5-line stub), `WorkflowDetailDialog.tsx`;
   gated blocks in tools.ts, PermissionRequest.tsx, commands.ts, both
   classifierDecision.ts copies, constants/tools.ts (ungated static import of
   WorkflowTool/constants.js would otherwise dangle), tasks.ts, tasks/types.ts,
   BackgroundTasksDialog.tsx; comment refs in worktree.ts ×2, sessionHooks.ts ×2, sdkProgress.ts.
3. `chore(gizzi-code): cut dormant MONITOR_TOOL stubs and gated consumers`
   — deleted `tools/MonitorTool/`, `tasks/MonitorMcpTask/` (missing
   killMonitorMcpTasksForAgent export), `MonitorPermissionRequest/`, `MonitorMcpDetailDialog.tsx`;
   gated blocks in tools.ts, PermissionRequest.tsx, tasks.ts, types.ts,
   BackgroundTasksDialog.tsx (incl. woven-in Monitors list section), runAgent.ts,
   BashTool.tsx + PowerShellTool.tsx (sleep-pattern block only ran under the
   never-enabled flag), BashTool/prompt.ts, LocalShellTask.tsx (notifications
   now always 'later'), query.ts comment.
4. `chore(gizzi-code): cut never-implemented UDS socket transport, keep HTTP peer mode`
   — deleted `ink-app/utils/udsMessaging.ts` (malformed, missing every export
   its consumers called) + `src/shared/utils/udsMessaging.ts` (twin, zero importers);
   removed messaging_socket_path (systemInit.ts), UDS server start (setup.ts),
   messagingSocketPath pid-file fields (both concurrentSessions.ts), dead /peers
   command gate (commands/peers/index.js never existed), UDS_INBOX disjunct on
   ListPeersTool. HTTP peer mode (GIZZI_ENABLE_RAILS_PEER, railsPeer.ts, Bus
   inbox) untouched; railsPeer gate simplified to env-only (behavior identical —
   flag was always off). UserTextMessage cross-session renderer ungated (envelope
   format comes from the HTTP path). AGENTS.md (root + cmd/gizzi-code) corrected:
   uds:/bridge: SendMessage address forms had no implementation — dropped;
   enabling passages now describe env var as only switch, HTTP polling as only transport.
5. `chore(gizzi-code): sync nocheck burn-down collateral after dormant-stub cuts`
   — queue.json regenerated with build-queue.mjs (same convention as 58c8a9007)
   after each rebase: totalNocheck 2006→**1929**, quarantined 25→**21**
   (suspect-malformed 6→2 — the 4 cut malformed stubs; upstream #592 grammar
   repairs had moved the other 4 to dead-shim), 101 batches; baseline regen
   count=2007→**1930**; deleted-paths.txt +13 (union-merged with #593 entries).

Deferred (documented, not blocking): `setup()`'s now-unused `messagingSocketPath`
parameter kept to avoid touching the `allternitInChrome/setup.ts` re-export
surface; three historical docs still mention cut symbols by design
(`docs/audit/allternit-audit.md`, `docs/learnings/INFRA_TRIAGE_PHASE_1_NOTES.md`,
`docs/programs/rails/RAILS_PRODUCT_UPDATE_SYSTEM_PROMPT.md`); `detectBlockedSleepPattern`
(now caller-less, exported) left in place; ListPeersTool/SendMessageTool
implementations absent on main is pre-existing and out of scope (HTTP mode
surface).

## Verification evidence (final tree, main @ c501db505 + this PR)

- `bash script/ensure-sdk-dist.sh` — OK
- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` — **exit 0**
- `bun run test` — **1311 pass / 42 skip / 0 fail**, 1353 tests / 107 files, SMOKE PASS
  (ts-nocheck burn-down guard + dead-code importer guard green against the
  regenerated queue.json and updated deleted-paths.txt)
- `node scripts/release-preflight.mjs` — **52 passed, 0 failed**
- Grep sweeps: zero cut flag/symbol references outside agent-ledger/archive,
  the deleted-paths ledger, and the three historical docs above.

## Incidents

- Main moved twice during the session (#592/#593 shim grammar repair +
  quarantine regen; #595 folder dissolve + #596 b0002 burn of 68 files).
  Both rebases resolved cleanly; the two upstream-repaired stubs this branch
  deletes (WorkflowPermissionRequest.tsx, MonitorMcpTask.ts) were re-confirmed
  as still-unimplemented TODO shims before keeping the deletion. Collateral
  commit re-resolved by re-running the sanctioned generators, never by hand-editing
  counts.
- `pnpm install` modified `pnpm-lock.yaml` (peer re-resolution); reverted per
  repo convention — no lockfile churn in the PR.

## Final state

- Shared checkout on main == origin/main (f29499d43), `git-discipline-check.sh`:
  `PASS git-discipline: on main == origin/main (f29499d43 Merge pull request #594 from Gizziio/ao/cut-dormant-stubs) / branches: 10, unmerged: 3 (all live-worktree or allowlisted) / worktree: clean`
- Session worktree + branch cleanup pending at session end per lifecycle step 9.
