# Off-queue TEMPORARY SHIM sweep (ao/offqueue-shim-sweep) — 2026-09-18

**Base:** origin/main @ 0c6540377 (post b0005/b0006). **Outcome: NO code changes — triage-only.** No PR opened (nothing safe to change); 24 files escalated with evidence.

## Re-derived list

`grep -rli "temporary shim" cmd/gizzi-code/src` → 31 files on current main. 7 are burn-owned
(`queue.json` batches/quarantined: useVoiceIntegration.tsx, jobs/classifier.ts,
skillSearch/localSearch.ts, skillSearch/remoteSkillLoader.ts, ink-app/utils/attributionHooks.ts,
**quarantined suspect-malformed**: services/compact/snipProjection.ts, services/contextCollapse/persist.ts).
PR #594 deletions verified: no WorkflowTool/ or MonitorTool/ dirs under ink-app/tools/.

**24 off-queue files** — every one has live importer chains (static and/or dynamic require with
.ts↔.js ESM remapping); none has broken grammar (all 24 verified parse via esbuild); none has a
pre-mass-import version (git history bottoms out at 2bda61382 / burn commits, so no
RESTORE-FROM-HISTORY candidates).

### Dormant stubs, LIVE (keep; ESCALATE-OWNER for real implementation)
- cli/transports/Transport.ts — type-imported by WebSocketTransport/SSETransport
- commands/install-github-app/types.ts — 4 sibling wizard step files
- commands/plugin/types.ts — 7 sibling plugin UI files
- components/CommandPalette.tsx — components/index.ts barrel → MainScreen/MainScreenEnhanced
- components/FeedbackSurvey/utils.ts — 5 sibling survey hooks/views
- components/Spinner/types.ts — Spinner/index.ts barrel (`SpinnerMode`) → Tool.ts, REPL.tsx, resume.tsx, …
- components/agents/new-agent-creation/types.ts — CreateAgentWizard → AgentsMenu
- constants/querySource.ts — `QuerySource` type imported by ink-app/Tool.ts
- services/skillSearch/featureCheck.ts, remoteSkillState.ts, telemetry.ts — required by SkillTool.ts + localSearch.ts
- tools/OverflowTestTool/OverflowTestTool.ts — feature-gated (`OVERFLOW_TEST_TOOL`) in tools.ts; required by permissions/classifierDecision.ts (both copies)
- tools/TerminalCaptureTool/prompt.ts — re-exported by ink-app/context/prompt.ts; required by classifierDecision
- tools/VerifyPlanExecutionTool/constants.ts — required by classifierDecision
- runtime/services/compact/cachedMicrocompact.ts — dynamically imported by runtime microCompact.ts + claude.ts
- runtime/services/contextCollapse/operations.ts — feature-gated (`CONTEXT_COLLAPSE`) require from autoCompact.ts; also analyzeContext/sessionRestore-adjacent ink-app consumers reference their own copy
- shared/utils/attributionHooks.ts — dynamic import in runtime/gizzi-core/setup.ts

### Implemented files with accurate TODO(types) shim comments (report only)
- components/FeedbackSurvey/useSurveyState.tsx, components/Spinner/utils.ts,
  hooks/useExitOnCtrlCD.ts, utils/secureStorage/fallbackStorage.ts,
  constants/product.ts (prose: accurately describes the live `tengu_bridge_repl_v2_cse_shim_enabled` gate)

### src/types special care (load-bearing; DO NOT touch — report/escalate)
- src/types/global.d.ts — header "missing modules / TEMPORARY SHIM" is still accurate (1159 lines; declares tree-sitter, color-diff-napi, lodash-es/*, etc.); marker NOT verified stale → left intact
- src/types/tools.ts — header "Replace with proper Allternit SDK types"; still the tool-type source for 15+ live files (Tool.ts, MCPTool, AgentTool, BashTool…); not verified stale → left intact

## Verification (branch == origin/main content-wise; all run in worktree)
- `bash script/ensure-sdk-dist.sh` + `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` → exit 0
- `bun run test` smoke → 1311 pass / 42 skip / 0 fail, 107 files (dead-code-guard + ts-nocheck-guard included, green)
- `node scripts/release-preflight.mjs` → 52 passed, 0 failed
- esbuild parse check on all 24 off-queue files → all parse
- `bash scripts/git-discipline-check.sh` (shared checkout) → PASS (main == origin/main 0c6540377)

## Honest deferrals
- 17 live dormant stubs need owner decision: implement the real feature or cut the calling
  feature (precedent: PR #594 owner-cut). The sweep cannot choose for them.
- 2 src/types header comments remain marked TEMPORARY SHIM; removal needs owner confirmation
  that proper SDK types now exist.
- deleted-paths.txt untouched (no deletions); eslint not run on changed files (none changed).
