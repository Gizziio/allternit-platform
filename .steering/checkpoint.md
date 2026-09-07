# Steering checkpoint

## Goal
Allternit Office extensions overhaul (worktree `allternit-session-office-ext-20260907`, branch `session/office-ext-20260907`). Phase 0 (761c5ff20) + Phase 1 (40732354d) committed & pushed. Phase 2 done uncommitted → committing next. Remaining: Phase 3 polish + final verification, then merge per AGENTS.md ritual.

Plan file: ~/.kimi-code/sessions/wd_joe_db5f68cf8615/session_2391eb48-ed41-4c53-8a90-5c115bedb60d/agents/main/plans/sandman-atom-smasher-sentry.md

## Just did (Phase 2, uncommitted)
- MS Office add-in taskpane mode switch: full in-pane AI (useOfficeSidepanelAdapter + ExtensionSidepanelShell via new OfficeSidepanelApp.tsx) when Office.js ready + bootstrap/auth context; companion shell preserved otherwise; live upgrade on auth/bootstrap events (runtime-mode.ts, 6 new tests)
- Document context: buildLiveDocumentContext() layers bridge summary → markdown export → officecli snapshot note, allSettled best-effort, 16k/24k caps (5 new tests)
- Real model default: agent-defaults.ts DEFAULT_OFFICE_MODEL='claude-3-5-sonnet' (matches gateway config/allternit.json agent.default_model; bootstrap payload verified to carry no model info)
- Pre-existing shell bug fixed: ToolExecutionCard officeCliArtifacts TDZ crash in ExtensionSidepanelShell.tsx
- Hosting: platform.allternit.com = Cloudflare Pages project allternit-platform from surfaces/platform.allternit.com/dist; deploy-cloudflare-pages.yml now builds the add-in with prod env; postbuild.mjs embeds dist/office-addins/ (prefers deployment/office-addins)
- Manifests regenerated: Version 1.1.0.0, SourceLocation platform.allternit.com/office-addins/...; deployment/ gitignored
- Gates: 143/143 tests, typecheck, prod-base build (assets under /office-addins/ confirmed), manifest verify, desktop prepare:office-addins interface unchanged

## Flags for later
- ARCHITECTURE.md still philosophically conflicts with the advanced settings panel (model/API-key UI) — needs a product decision, not done
- Local `pnpm build` in add-in without env rewrites tracked manifests to localhost (pre-existing footgun)
- pnpm test:hosted / test:binding need live endpoints — sideload smoke remains manual

## Next
- Commit Phase 2, push
- Phase 3: GenOffice rename in desktop, extensions README refresh, DEPENDENCY_AUDIT note, final sweep (typecheck affected, wxt build, office-surface build, add-in tests)
- Then: session attestation in agent-ledger/summaries/, LEDGER.md entry, merge to main, cleanup worktree per AGENTS.md
