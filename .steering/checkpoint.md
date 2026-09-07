# Steering checkpoint

## Goal
Allternit Office extensions overhaul (worktree `allternit-session-office-ext-20260907`, branch `session/office-ext-20260907`). Phase 0 DONE (committed 761c5ff20, pushed). Phase 1 DONE (uncommitted, about to commit). Remaining: Phase 2 (MS Office add-in full AI agent + hosting), Phase 3 (polish + final verification).

Plan file: ~/.kimi-code/sessions/wd_joe_db5f68cf8615/session_2391eb48-ed41-4c53-8a90-5c115bedb60d/agents/main/plans/sandman-atom-smasher-sentry.md

## Just did (Phase 1, uncommitted → committing next)
- OfficeHost extension slot: `OfficeExtensionDescriptor`/`OfficeExtensionContext` + `host.extensions` in suite bridge types; `OfficeAiSlot` + `useOfficeExtensions` + `createAllternitAssistantExtension` in suite src/extensions/ (exported via root and ./bridge subpaths)
- OfficeAiSlot occupies each vendored app's existing chat section (fallback = built-in AiPanel/AiChatPanel when no extensions registered); wrapped docs/sheets(ExcelShell)/slides/pdf mount sites
- Allternit Assistant panel: useOfficeAi() contract, model picker per appKey, AgentLoop streaming chat, active-document awareness via module registry populated by suite app adapters
- Wired: office.allternit.com App.tsx (incl. Sign tab side slot, 360px + AI rail) and ai.allternit.com views/{docs,sheets,slides,pdf} via shared getOfficeExtensions()
- Gates green: suite + 4 vendored apps + office-surface typecheck/build; ai.allternit.com typecheck/build; xlsx-engine tests

## Known decisions / flags
- Sign tab uses appKey="pdf" (OfficeAppKey has no 'sign'; widening breaks createStandaloneAiClient strict indexing). Cosmetic: Sign-tab Assistant may echo PDF-tab document name.
- Desktop window size left at 1280×900 (slot lives in existing collapsed dock).
- Vendored page-agent dist bundles had to be built in-worktree (gitignored) before extension wxt build would pass — fresh-worktree bootstrap step, not a code issue.

## Next
- Commit Phase 1, push
- Phase 2: rewire allternit-office-addin taskpane App.tsx → useOfficeSidepanelAdapter + ExtensionSidepanelShell (companion fallback preserved); document context into agent; serving /office-addins under platform.allternit.com; manifest regen + version bump; README/DEPLOYMENT fixes
- Phase 3: GenOffice rename, extensions README refresh, audit-doc note, final sweep
