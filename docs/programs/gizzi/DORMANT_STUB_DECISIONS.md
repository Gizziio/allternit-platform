# Gizzi-code dormant stub decisions — owner review

**What this is.** On 2026-09-18 the off-queue shim sweep triaged 17 live dormant stubs in
`cmd/gizzi-code/src` — files marked TEMPORARY SHIM that were born in the 2026-07-26 mass
import (2bda61382), were never implemented in repo history, but are wired into real importer
chains. Every one parses and typechecks; each stands in for a feature that either needs to be
built or deliberately killed. Triage evidence:
`agent-ledger/summaries/2026-09-18-1308-ao-offqueue-shim-sweep-kimi-code-offqueue-shim-sweep.md`
(attestation base `f49e3c252`).

**How to use it.** Mark one DECISION per row: **IMPLEMENT** (build the real feature),
**CUT** (delete the stub and its flag-gated consumers), or **KEEP-DORMANT** (leave the shim;
record why). Then execute per the appendix below for any CUT rows.

**Precedent.** PR #594 (merged 2026-09-18, `chore(gizzi-code): cut four dormant
never-implemented feature stubs`) cut REVIEW_ARTIFACT, WorkflowTool/WorkflowScripts, and two
others the same day using exactly this decision pattern.

**UI-visibility column** was verified by grep on `f49e3c252` (command registrations, keybindings,
settings entries, component mounts) — not guessed.

## Decision table

| # | Stub (path under `cmd/gizzi-code/src`) | Feature it stands in for | Evidence of life (importer chain) | Has visible UI? | Effort | My recommendation | Owner decision | Notes |
|---|----------------------------------------|--------------------------|-----------------------------------|-----------------|--------|--------------------|--------------|-------|
| 1 | `cli/ui/ink-app/cli/transports/Transport.ts` | Transport interface + `BaseTransport` for the headless event transports | Type-imported by `transports/WebSocketTransport.ts` (801 lines, real) and `transports/SSETransport.ts` (712 lines, real) | No — headless transport layer, no UI touchpoints | n/a | **KEEP-DORMANT** | | Structural type contract for two real transports; not a feature. `BaseTransport` itself has zero callers — delete just the class if pruning. |
| 2 | `cli/ui/ink-app/commands/install-github-app/types.ts` | GitHub App install wizard state types | 3+ sibling wizard files import `State`/`Warning`/`Workflow` from it (`install-github-app.tsx`, `CreatingStep.tsx`, `WarningsStep.tsx`) | Yes — `/install-github-app` is registered in `commands.ts:344` and actively advertised by the tip registry ("Run /install-github-app to tag @gizzi…") | n/a | **KEEP-DORMANT** | | Type-shape stub feeding a live, advertised command. Per rule: structural, not a feature. (Sweep flags missing type exports the `@ts-nocheck` wizard files import — cosmetic until wizard gets typed.) |
| 3 | `cli/ui/ink-app/commands/plugin/types.ts` | Plugin manager view-state types | 6 sibling plugin UI files import `ViewState`/`PluginSettingsProps` (`ManagePlugins`, `BrowseMarketplace`, `DiscoverPlugins`, `AddMarketplace`, `ManageMarketplaces`, `PluginSettings`) | Yes — `/plugin` registered in `commands.ts:355`; `PluginCommand` in `cli/commands/registry.ts` | n/a | **KEEP-DORMANT** | | Type-shape stub feeding a live command. Structural per rule. |
| 4 | `cli/ui/ink-app/components/CommandPalette.tsx` | Real command-palette overlay (search + registry navigation) | Barrel `components/index.ts` → imported and rendered by `screens/MainScreen.tsx` and `screens/MainScreenEnhanced.tsx`, opened via keybinding + typing `/` on empty input | **No (surprising)** — both MainScreens are exported from the barrel but repo-wide grep finds no mount of either screen anywhere; the TUI runs `screens/REPL.tsx` | S to cut; M to implement | **Owner weigh — LEAN CUT** | **CUT (done, PR #616)** | Stub, both MainScreens' palette wiring (triggers, render branches, keybinding + help-menu mentions), and the barrel export were cut 2026-09-18. The MainScreen screens themselves stay exported (unmounted dead cluster beyond the palette was not in scope). |
| 5 | `cli/ui/ink-app/components/FeedbackSurvey/utils.ts` | Survey data formatting/validation + survey type exports | Sibling survey files import `FeedbackSurveyResponse`/`FeedbackSurveyType` from it (`FeedbackSurvey.tsx`, `FeedbackSurveyView.tsx`, `useFeedbackSurvey.tsx`); the survey component itself is rendered by `REPL.tsx:5355-5357` | Yes — post-compact, memory, feedback, and frustration-detection surveys all render in the live REPL | S | **IMPLEMENT (S)** | | Visible UI + small gap. Gap is smaller than it looks: the two exported functions (`formatSurveyData`, `validateSurveyResponse`) have **zero callers**; what's actually missing is the `FeedbackSurveyResponse`/`FeedbackSurveyType` type exports live siblings import (masked by `@ts-nocheck`). Add the types; wire or drop the two functions. |
| 6 | `cli/ui/ink-app/components/Spinner/types.ts` | Spinner state/type definitions (`SpinnerState`, `SpinnerType`, `SpinnerMode`) | `Spinner/index.ts` barrel → `Tool.ts`, `REPL.tsx`, `resume.tsx`, … | No — type-only surface | n/a | **KEEP-DORMANT** | | Type-shape stub feeding live files. Structural per rule. |
| 7 | `cli/ui/ink-app/components/agents/new-agent-creation/types.ts` | Create-agent wizard state types | `CreateAgentWizard` → `AgentsMenu` | Yes (parent wizard surfaces in the agents menu), but the stub itself is type-only | n/a | **KEEP-DORMANT** | | Type-shape stub feeding live files. Structural per rule. |
| 8 | `cli/ui/ink-app/constants/querySource.ts` | `QuerySource` origin taxonomy + `QUERY_SOURCES` constants | `QuerySource` type imported by `ink-app/Tool.ts`; module referenced by ~10 runtime files (compact, claude, logging, memdir, …) | No — constants/type only | n/a | **KEEP-DORMANT** | | Structural constant/type module, same class as the types.ts stubs: it feeds live code and gates nothing. |
| 9 | `cli/ui/ink-app/services/skillSearch/featureCheck.ts` | Remote skill-search feature gate + canonical-prefix stripping | `SkillTool.ts` (call sites at :142, :382, :497, :610, :664), `localSearch.ts`, `attachments.ts` (both tree copies), `constants/prompts.ts:786` | No — `isSkillSearchEnabled()` returns `false`; no component, screen, settings, or doc references skill search | M | **CUT** | **CUT (done, PR #616)** | Soft-gated (stub returns false, no `feature()` flag), never implemented, no visible UI → PR #594 pattern. Cut all three skillSearch stubs together; de-gate the SkillTool/localSearch/attachments call sites. Executed 2026-09-18. |
| 10 | `cli/ui/ink-app/services/skillSearch/remoteSkillState.ts` | Remote skill discovery state | `SkillTool.ts:386, :982` (`getDiscoveredRemoteSkill`) | No (see #9) | — | **CUT** (with #9) | **CUT (done, PR #616)** | Same feature cut as #9. Executed 2026-09-18. |
| 11 | `cli/ui/ink-app/services/skillSearch/telemetry.ts` | Remote-skill load telemetry | `SkillTool.ts:995, :1015` (`logRemoteSkillLoaded`) | No (see #9) | — | **CUT** (with #9) | **CUT (done, PR #616)** | Same feature cut as #9. Executed 2026-09-18. |
| 12 | `cli/ui/ink-app/tools/OverflowTestTool/OverflowTestTool.ts` | Internal overflow-testing tool | `feature('OVERFLOW_TEST_TOOL')` gated `safeRequire` in `tools.ts:112`; name mirrored in both `classifierDecision.ts` copies as an ant safe-tool | No — dev tooling; no doc references it (checked `docs/`, `cmd/gizzi-code/docs`, tests) | S | **CUT** | **CUT (done, PR #616)** | Testing/dev-tooling stub with no dev-doc references → CUT per rule. Note: `deleted-paths.txt` already lists the old `components/tools/OverflowTestTool` variant at a stale path — see drift note below. Executed 2026-09-18 (live `tools/` path appended alongside the stale entry). |
| 13 | `cli/ui/ink-app/tools/TerminalCaptureTool/prompt.ts` | `terminal_capture` tool (terminal output capture as tool input) | Name constant re-exported by `context/prompt.ts:15`; `feature('TERMINAL_PANEL')` gated `safeRequire` in `tools.ts:118` (target `TerminalCaptureTool.tsx` **never existed** → always `undefined`); both `classifierDecision.ts` copies | No — for the tool. The terminal **panel** is a separate, real feature (`utils/terminalPanel.ts`, `meta+j` binding in `defaultBindings.ts:62`, help-menu line) and must not be touched | S | **CUT** | **CUT (done, PR #616)** | CUT removes the capture-tool blocks in `tools.ts`, both `classifierDecision.ts` copies, and the `context/prompt.ts` re-export. The live terminal panel is unaffected. Executed 2026-09-18. |
| 14 | `cli/ui/ink-app/tools/VerifyPlanExecutionTool/constants.ts` | `verify_plan_execution` tool (plan-vs-execution verifier) | `tools.ts:96` gated on `GIZZI_CODE_VERIFY_PLAN === 'true'` (target tool file never existed); both `classifierDecision.ts` copies gate on `USER_TYPE === 'ant'` | No — internal ant-only tooling; no doc references | S | **CUT** | **CUT (done, PR #616)** | Gate mismatch drift: `tools.ts` keys on `GIZZI_CODE_VERIFY_PLAN`, `classifierDecision` on `USER_TYPE === 'ant'`. Remove both blocks. Executed 2026-09-18. The wider ant-only `verify_plan_reminder` attachment subsystem (messages/attachments/AppStateStore) was left in place — not in this row's evidence. |
| 15 | `runtime/services/compact/cachedMicrocompact.ts` | Cache-editing microcompact (cached compaction results across turns) | `feature('CACHED_MICROCOMPACT')` gated requires in `runtime/services/compact/microCompact.ts:277` and `runtime/services/api/claude.ts` (3 sites); call sites in both runtime and ink-app tree copies | No — every getter returns disabled/empty; no UI, settings, or doc references the flag | M | **CUT** | **CUT (done, PR #616)** | Flag-gated, never implemented, no visible UI → PR #594 pattern. Cut runtime + ink-app copies of the stub and the gated blocks in `microCompact.ts`/`claude.ts` (both copies). Note: ink-app has a sibling `services/compact/cachedMCConfig.ts` — verify whether it is the intended real config home before deleting. Executed 2026-09-18: both stub copies cut; `cachedMCConfig.ts` verified to be a stub (returns null) but is not in this table, so it was left on disk (orphaned by the cut) — a future-cut candidate. |
| 16 | `runtime/services/contextCollapse/operations.ts` | Context collapse (mid-session context snipping with visualization) | `feature('CONTEXT_COLLAPSE')` gated requires in `autoCompact.ts`, `REPL.tsx:4112`, `TokenWarning.tsx` (CollapseLabel), `ContextVisualization.tsx` (CollapseStatus), `commands/context/context.tsx`, `analyzeContext.ts`, `sessionRestore.ts`; ink-app consumers reference their own copy | **No** — UI scaffolds exist (token-warning label, context viz, `/context` projection) but every path is behind `feature('CONTEXT_COLLAPSE')` AND `isContextCollapseEnabled()` (returns `false`), so nothing renders | M | **CUT** | **CUT (done, PR #616)** | Literal fit for the CUT rule: flag-gated, never implemented, no visible UI. Largest blast radius of the CUT rows — the gated UI blocks in TokenWarning/ContextVisualization//context/analyzeContext go with it. If the owner wants the mid-build UI kept as a scaffold, KEEP-DORMANT is the documented alternative. Executed 2026-09-18 (runtime + ink-app `operations.ts`, all gated consumer blocks in both trees, plus the `CtxInspectTool` gate in tools.ts and the `setup.ts` init block). The separate quarantined `persist.ts` stub and the sessionStorage `contextCollapse*` log-entry fields were left in place — not this row's stub. |
| 17 | `shared/utils/attributionHooks.ts` | Commit-attribution hook registration (attribution tracking hooks on file ops) | `feature('COMMIT_ATTRIBUTION')` gated dynamic import in `runtime/gizzi-core/setup.ts:353` (`registerAttributionHooks()`); `clearAttributionCaches` imported by `postCompactCleanup.ts` and `commands/clear/caches.ts` (both copies) | No — hooks register nothing; `getAttribution` returns `[]` and has no live callers | S | **CUT** | **CUT (partial — PR #616)** | Rule-literal CUT (flag-gated, never implemented, no UI), **but the parent feature is real**: `commitAttribution.ts` (961 lines) and the `COMMIT_ATTRIBUTION` flag are live across worktree/bashProvider/attribution/REPL/commit command. The cut removes only the dormant hooks layer and its call sites; the attribution engine stays. Owner may instead KEEP-DORMANT as part of a commit-attribution follow-up. Executed 2026-09-18 for the **shared twin** (`src/shared/utils/attributionHooks.ts` + setup.ts registration + the dangling runtime postCompactCleanup import). The **ink-app copy** (`src/cli/ui/ink-app/utils/attributionHooks.ts`) is burn-owned (typecheck-burndown batch b0001) — its deletion was STOPPED per the queue-exclusion rule; its two consumers (clear/caches.ts, ink-app postCompactCleanup.ts) were left gated and intact. |

**Recommendation tally: 1 IMPLEMENT · 9 CUT · 6 KEEP-DORMANT · 1 owner-weigh (lean CUT).**

### Surprises from the UI investigation (worth the owner's attention)

- **#4 CommandPalette is not actually user-visible.** Both MainScreens have full palette wiring
  (keybinding, `/` trigger, render branches) but neither screen is mounted anywhere — the live
  TUI is REPL.tsx. The "visible UI" signal in the sweep evidence described wiring, not a mounted
  surface.
- **#5 FeedbackSurvey/utils.ts is missing type exports its live siblings import**
  (`FeedbackSurveyResponse`, `FeedbackSurveyType`). It compiles only because the sibling burn
  files carry `@ts-nocheck`. The two functions it does export are dead code.
- **#13 the terminal panel and the terminal capture tool are different things.** The panel is
  real and shipped (keybinding + help menu); only the capture *tool* is a never-implemented stub.
- **Drift noticed, not fixed (per session rules):** `test/deleted-paths.txt` lists the three
  dev-tool stubs under stale `components/tools/…` paths that don't match the live
  `tools/…` locations; `VerifyPlanExecutionTool`'s gate differs between `tools.ts`
  (`GIZZI_CODE_VERIFY_PLAN`) and `classifierDecision.ts` (`USER_TYPE === 'ant'`).

## How to execute a CUT (appendix)

Follow the PR #594 pattern exactly — one cut per feature, re-verify before each deletion:

1. **Delete the stub and its emptied directory.** Remove the stub file; if its directory
   becomes empty, remove the directory too. Append every deleted path to
   `cmd/gizzi-code/test/deleted-paths.txt` (dead-code guard reads it).
2. **Remove the feature-flag-gated consumer blocks found in the triage evidence.** Each row
   above lists its gated import/destructure/switch blocks (e.g. `tools.ts` `safeRequire` blocks,
   both `classifierDecision.ts` copies, `feature('…')` requires in runtime consumers). Several
   stubs are missing exports their gated consumers destructure — enabling the flag would throw,
   which is why the blocks must go with the stub.
3. **Grep the flag name repo-wide and de-advertise.** `grep -rn "<FLAG_NAME>"` across the repo
   (watch for both tree copies, `runtime/` and `cli/ui/ink-app/`) and remove stale comment
   references; update `docs/` and `REPO_STRUCTURE.md` **only if they list the stub** (checked
   for these 17: `REPO_STRUCTURE.md` lists none; doc hits are archive-only).
4. **Gates before merge:** `bash script/ensure-sdk-dist.sh`, then
   `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`, then `bun run test` smoke, then
   `node scripts/release-preflight.mjs` — all must be green (sweep-day baseline: smoke
   1311 pass / 0 fail, preflight 52/0).

## Cross-links

- Triage evidence: `agent-ledger/summaries/2026-09-18-1308-ao-offqueue-shim-sweep-kimi-code-offqueue-shim-sweep.md`
- Cut precedent: PR #594 — `chore(gizzi-code): cut four dormant never-implemented feature stubs` (merged 2026-09-18)
- Related deferred items from the same sweep (not in this table): 2 `src/types` header comments
  awaiting owner confirmation that proper SDK types exist.
