# Orphaned-stub follow-ups after PR #616 (dormant-stub CUT lane)

**Session:** ao/orphaned-stub-followups · **Agent:** kimi-code · **Date:** 2026-09-18
**Base:** `56085d0db` · **PR:** #641 (merged, merge SHA `4f09da6516fbb400caf805b8e5b16c1a5598b143`)

## What was done

Triage of every follow-up candidate PR #616's report listed outside its decision
table, then execution of only the unambiguous dead deletions. Worktree:
`allternit-ao-orphans` on `ao/orphaned-stub-followups`.

### Deleted (verified dead: zero importers of any kind, off-queue, not quarantined)

- `cmd/gizzi-code/src/cli/ui/ink-app/services/compact/cachedMCConfig.ts` — orphaned by
  PR #616 row 15 (cachedMicrocompact cut). No static imports, no dynamic requires, no
  safeRequire strings; `getCachedMCConfig`/`setCachedMCConfig` referenced nowhere.
- `cmd/gizzi-code/src/cli/ui/ink-app/tools/DiscoverSkillsTool/prompt.ts` —
  `DISCOVER_SKILLS_PROMPT` referenced nowhere; the tool never existed. Emptied dir
  removed with the file.

Both paths appended to `cmd/gizzi-code/test/deleted-paths.txt` (dead-code-guard
manifest). No flag constants were orphaned by either cut.

### Triaged, left in place (documented as rows 18–22 of
`docs/programs/gizzi/DORMANT_STUB_DECISIONS.md`)

- **skillSearch/localSearch.ts + remoteSkillLoader.ts — LIVE-gated, burn-owned.**
  Importers remain behind `feature('EXPERIMENTAL_SKILL_SEARCH')`
  (`commands.ts:122` safeRequire, `useManageMCPConnections.ts:28`). Both files are in
  typecheck-burndown batch **b0102** (state NEW) — deletion stopped per the
  queue-exclusion rule (the concurrent burn agent owns them).
- **skillSearch/prefetch.ts — deferred gated-block+stub cut.** Off-queue, and
  dynamically unreachable (`feature('EXPERIMENTAL_SKILL_SEARCH')` compiles OFF — live
  `bun` run verified; production `build-production.js` defines only NODE_ENV), but
  three gated importer sites remain (attachments.ts both tree copies, query.ts) whose
  `typeof import()` annotations would TS2307 without the file. Cutting it means
  removing those blocks with the stub (PR #594 shape); deferred one lane for owner
  visibility since PR #616 deliberately left the gated importers.
- **verify_plan_reminder subsystem — OWNER DECISION.** Mapped end-to-end: attachment
  union member (both `types/message.ts` copies), `VERIFY_PLAN_REMINDER_CONFIG` +
  `getVerifyPlanReminderAttachment` + `getVerifyPlanReminderTurnCount` + gated
  `maybe('verify_plan_reminder', …)` pipeline entry (both `attachments.ts` copies),
  reminder rendering case (both `messages.ts` copies),
  `components/messages/nullRenderingAttachments.ts:45`,
  `AppStateStore.pendingPlanVerification` + `REPL.tsx:3477` writer,
  `ExitPlanModeV2Tool.ts` comment, dead ternary in
  `ExitPlanModePermissionRequest.tsx:368`, and `shared/tools/VerifyPlanExecutionTool/`
  (empty `export {}` shim — the advertised tool was never implemented, zero importers).
  Double-gated `USER_TYPE === 'ant'` + `GIZZI_VERIFY_PLAN`. Cut ≈ 10 files (mostly twin
  edits, S effort); implement = real `VerifyPlanExecution` tool + background verifier
  (L effort, days). Left in place; owner decision recorded in the doc.

## Verification

- `npx tsc --noEmit` (cmd/gizzi-code) — exit 0
- `bun run test` — **1311 pass / 0 fail** (includes dead-code-guard; matches
  sweep-day baseline exactly)
- `node scripts/release-preflight.mjs` — **52 passed, 0 failed**
- Grep sweeps: no remaining references to either deleted path outside the guard
  manifest and the decision doc; REPO_STRUCTURE.md lists neither.

## Incidents / deferrals

- Deferred: prefetch.ts gated-block+stub cut (row 19) — needs owner-visible go-ahead
  since it edits live importer files.
- Deferred: verify_plan_reminder subsystem (row 22) — owner decision (cut vs
  implement).
- Left to burn lane: localSearch.ts / remoteSkillLoader.ts (batch b0102).
