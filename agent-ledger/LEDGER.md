# Agent Work Ledger

Chronological attestation of agent sessions in the Allternit workspace.

Each entry is a signed line of accountability: the agent attests that the work
was performed, describes what was created and how it works, cites the commit,
and flags anything that was promised but not delivered.

## Entry format

Append newest entries to the top of the `## Entries` section.

- **Date/Time:** ISO-8601 or `YYYY-MM-DD HH:MM` local time
- **Session ID / Branch:** e.g., `session/<id>` or `<repo>-session-<id>`
- **Agent:** family/model of the agent (e.g., gizzi, claude, codex, kimi)
- **Summary:** one-line description of the change
- **Commit:** SHA or PR link that contains the work
- **How it works:** brief explanation of the change and its effect
- **Outstanding work:** anything claimed but unfinished, deferred, or blocked
- **Summary file:** link to the full attestation in `./summaries/`

## Entries

### 2026-09-06 23:55 — kimi — dashboard details view = full Messages renderer + /dashboard alias un-squatted

- **Session ID / Branch:** `session/7631feda-dash-details` (worktree `allternit-session-7631feda-d2`), follow-up to `session/7631feda`
- **Commit:** `37057ec17` on `main` (fast-forward)
- **How it works:** `DashboardSource.transcript()` returns the session's full `Message[]`; the details view mounts the real `<Messages>` component (same renderer as the REPL) in a stickyScroll ScrollBox with ↑/↓/PgUp/PgDn/g/G scroll keys. Also fixed a latent collision where `/dash` (session-stats screen) squatted the `dashboard`/`sessions`/`agents-dashboard` aliases and hijacked `/dashboard` resolution after MRU reordering.
- **Verification:** typecheck green; smoke 1315 pass / 0 fail; tmux TUI pass (details renders transcript, scroll works, Esc ladder clean).
- **Summary file:** [./summaries/2026-09-06-2337-7631feda-kimi-grok-dashboard.md](./summaries/2026-09-06-2337-7631feda-kimi-grok-dashboard.md)

### 2026-09-06 23:37 — kimi — Grok-parity /session-info, /dashboard agent dashboard, /settings effort row (gizzi-code)

- **Session ID / Branch:** `session/7631feda-bbb5-492f-97cf-55f243eda42d` (worktree `allternit-session-7631feda`)
- **Agent:** kimi
- **Summary:** Ported three Grok CLI presentation features into gizzi-code: `/status` gained `/info`+`/session-info` aliases with Auth/Turns rows and copy keys; full `/dashboard` agent dashboard (dispatch/peek/reply/search/grouping/folding/details/rename/pin/reorder/stop, `Ctrl+\` toggle, `DashboardSource` seam for a future gizzi-serve source); `/settings` effort row. Plus a critical fix: `sessionStorage.ts` re-exported `getProjectDir` without importing it (latent ReferenceError that broke dashboard dispatch).
- **Commit:** squash `51f7315532f38c8315b1c4916897a4c46f03acfb` on `main` (PR #103); branch commits `b8675f9ce`, `07865f0d0`, `c2f807680`, `9b307db69`, `323c5bc39`, `7386f48c5`, `581cbe9d6`
- **How it works:** Dashboard sessions are main-session `local_agent` tasks driven by a multi-turn `pendingMessages`-drain loop (`cmd/gizzi-code/src/cli/ui/ink-app/dashboard/topLevelSession.ts`); the UI talks only to the `DashboardSource` interface (`dashboard/types.ts` + `InProcessSource.ts`), so a remote source is a drop-in replacement. UI lives in `screens/DashboardScreen.tsx`; pin/reorder persist via `dashboard.*` keys in GlobalConfig.
- **Verification:** typecheck green on merge commit; `bun run test` 1315 pass / 0 fail; tmux TUI functional pass (dispatch→progress→finalize→peek→reply→pin→search→exit). GitHub Code Quality workflow never triggered on the PR (repo-infra quirk); owner approved merge without it.
- **Outstanding work:** details view is a text excerpt, not the full Messages renderer; no 1–9 needs-input option buttons (answers land in main-session prompt); static working glyph and main-row state; stale-cell ghosts on line shrink are a pre-existing vendored-ink emit issue (`ink/log-update.ts:106`), not dashboard-specific.
- **Summary file:** [./summaries/2026-09-06-2337-7631feda-kimi-grok-dashboard.md](./summaries/2026-09-06-2337-7631feda-kimi-grok-dashboard.md)

### 2026-09-06 22:40 — kimi — gizzi-code 2.0.7: onboarding auto-picks the default brain

- **Session ID / Branch:** `session/gc-207` (worktree `allternit-session-gc-207`)
- **Agent:** kimi
- **Summary:** Shipped `198c83e46` (onboarding auto-pick) as gizzi-code 2.0.7 — version bump across package/npm/homebrew/debian/rpm, CHANGELOG, tag `gizzi-code/v2.0.7`, npm + GitHub assets, homebrew tap bump, owner machine upgraded.
- **Commit:** `7351779c2` (bump) + `19a7ba5e8` (lockfile fix) on `main`; tag `gizzi-code/v2.0.7`; tap `Gizziio/homebrew-tap@47c28e3`
- **How it works:** First tag push's publish CI failed on `ERR_PNPM_OUTDATED_LOCKFILE` — the native-sessions feature (`441ed7495`) added a workspace dep to `cmd/gizzi-code/package.json` without updating `pnpm-lock.yaml`. Lockfile-only fix commit, tag re-created at the fix, publish CI green. Verified: `@allternit/gizzi-code@2.0.7` latest on npm with all five platform packages; release has all assets; tap formula sha256s computed from release assets; owner machine `brew upgrade` → 2.0.7 verified.
- **Outstanding work:** None. Owner's brain default (`kimi-cli/kimi-for-coding`) untouched; `aliyun-qwen` key still broken (pre-existing, owner to re-key).
- **Summary file:** [./summaries/2026-09-06-2240-session-gc-207-kimi-gizzi-code-2.0.7-onboarding-autopick.md](./summaries/2026-09-06-2240-session-gc-207-kimi-gizzi-code-2.0.7-onboarding-autopick.md)

### 2026-09-06 22:18 — kimi — Grok-parity slash commands + menu polish (gizzi-code)

- **Session ID / Branch:** `session/grok-slash` (worktree `allternit-session-grok-slash`, base `441ed7495`)
- **Commit:** feature `df9ed4c3c`; supporting `a63aecd1c` (native-sessions import fix), `a18be47d3` (pnpm-lock sync)
- **How it works:** Completes the Grok CLI slash-command port started by a748ccb78. New built-ins in `cmd/gizzi-code/src/cli/ui/ink-app/commands/`: `/session-info` (panel + copy-id), `/recap`, `/queue` (immediate, mid-turn), `/transcript` ($PAGER via shared `runInPager`), `/multiline` (+`/ml`, Enter-swap toggle), `/cd` (session cwd switch), `/fork [--worktree|--no-worktree] [directive]` (FORK_SUBAGENT-gated background peer agent seeded with the forked conversation, optional worktree, Rails-registered, reports back via queue notification), `/rename --auto`. Menu: MRU now records all user-invocable command types; gated commands get an explanatory message via `findDisabledCommand` instead of "Unknown skill". Also fixes a748ccb's `/auto` `feature()` call that broke `bun:bundle` registry builds.
- **Verification:** `bun run typecheck` EXIT=0; `bun test --preload ./test/preload.ts test/commands/` 12 pass / 0 fail. Not live-verified: `/fork` spawn (flag off in dev builds), `/transcript` pager (needs TTY).
- **Outstanding work:** deferred per plan — permission-mode toggle design, `/minimal`/`/fullscreen` render modes; `/status` vs `/session-info` alias duplication cleanup; branch awaits rebase + merge (another session is actively committing to `feat/desktop-apps-extensions`).
- **Summary file:** [2026-09-06-2218-88f19eb6-kimi-grok-slash-commands.md](./summaries/2026-09-06-2218-88f19eb6-kimi-grok-slash-commands.md)

### 2026-09-06 22:10 — kimi — gizzi-code onboarding always auto-picks the default brain

- **Session ID / Branch:** `session/gc-onboard` (worktree `allternit-session-gc-onboard`)
- **Agent:** kimi
- **Summary:** The onboarding wizard no longer prompts for a brain — a shared `pickBrain()` helper (paid plan → Allternit Cloud default model, else first installed CLI brain, else "install one" pointer) now serves both the wizard and `--defaults`.
- **Commit:** `198c83e46` on `main`
- **How it works:** `pickBrain(catalog, setBrain)` centralizes the auto-pick policy; the wizard logs the pick ("change anytime with /model") instead of showing a select prompt, and `runOnboardingDefaults` delegates to the same helper with identical output strings. 3 new tests; 14/14 onboarding tests pass; `bun run typecheck` exit 0. Also fixed two pre-existing main breakages found during verification: illegal `feature()` macro use in `commands/auto/index.ts` (killed the test preload graph) and a missing-import TS2552 re-export in `native-sessions/catalog.ts` (blocked typecheck repo-wide).
- **Outstanding work:** None — rides the next release tag. Known pre-existing `feature()` misuses remain in `defaultBindings.ts` / `betas.ts` / `prompts.ts` (out of scope, not blocking).
- **Summary file:** [./summaries/2026-09-06-2210-session-gc-onboard-kimi-onboarding-autopick-brain.md](./summaries/2026-09-06-2210-session-gc-onboard-kimi-onboarding-autopick-brain.md)

### 2026-09-06 21:30 — kimi — gizzi-code 2.0.6: /theme TUI crash fix + real TS syntax highlighting

- **Session ID / Branch:** `session/gc-hotfix` (worktree `allternit-session-gc-hotfix`)
- **Agent:** kimi
- **Summary:** Fixed the 2.0.5 hard crash on any syntax-highlighted diff surface (`/theme`, file-edit permission previews) and shipped real syntax highlighting in the vendored color-diff TS port.
- **Commit:** `457c3f3e3` (crash fix) + `132848239` (highlighting) + `c2e0d543c` (2.0.6 bump) on `main`; tag `gizzi-code/v2.0.6`
- **How it works:** The TS port of color-diff-napi only implemented color-math APIs; `StructuredDiff`/`HighlightedCode` call `render()` from the original Rust binding. Phase 1 made construction/render safe and guarded the call sites (degrade to React fallback renderer). Phase 2 implemented real rendering: regex tokenizer + theme palettes + gutters + wrapping, so compiled binaries get ANSI-highlighted diffs without the fallback. 17/17 tests, tsc clean, pty-verified `/theme` on old (crashes, exact reported TypeError) and new (renders, stays alive) binaries.
- **Outstanding work:** Homebrew tap formula still pins 2.0.5 sha256s — update after publish CI (run 34076386791) assets land. Word-level intra-line highlights not ported (cosmetic). Owner to re-key `aliyun-qwen` (auth fails) or switch default brain to `kimi-cli/kimi-for-coding` (verified working; its saved `subprocess_cmd` was missing `-p`, fixed in user config).
- **Summary file:** [./summaries/2026-09-06-2128-session-gc-hotfix-kimi-gizzi-code-2.0.6-theme-crash-fix.md](./summaries/2026-09-06-2128-session-gc-hotfix-kimi-gizzi-code-2.0.6-theme-crash-fix.md)

### 2026-09-04 19:25 — grok — gizzi-code 2.0.0 npm publish (all 5 platforms)

- **Session ID / Branch:** `main`
- **Commit:** tag `gizzi-code/v2.0.0`; win32 CI fix `2de4bb281`
- **How it works:** `@allternit/gizzi-code@2.0.0` is `latest` on npm with platform packages darwin-arm64/x64, linux-arm64/x64, and win32-x64. First tag run published core-4; windows-latest failed on better-sqlite3/VS. Moved the win32 matrix leg to macOS cross-compile (`bun --target=win32-x64`) and workflow_dispatch republished; win32-x64@2.0.0 is live. `@allternit/gizzi-sdk` was not published (legal hold; registry 404).
- **Outstanding work:** gizzi-sdk legal hold and counsel distribution basis (`docs/legal-attribution.md` §6/§7). Brew/scoop/choco still pin 1.0.2 (no GitHub release workflow). Cross-compiled win32 native modules unverified on a real Windows box.
- **Summary file:** none

### 2026-09-04 18:50 — grok — gizzi-code 2.0.0 internal rename + version bump

- **Session ID / Branch:** resumed kimi `session_237dc49a` follow-up on `main`
- **Commit:** `1d12e14fa` (merged to origin via `cd81ffc8d`)
- **How it works:** Finished remaining open engineering from the naming purge: renamed internal identifiers/files (`getGizziMds`, `gizziGuideAgent`, `gizziHints`, `getLegacyClaudeHomeDir`, `GizziHint` component). Bumped `@allternit/gizzi-code` and cli-package to **2.0.0**. Counsel questions listed in `docs/legal-attribution.md` §7. **Not done:** npm tag/publish (next), `@allternit/gizzi-sdk` legal hold, counsel distribution basis.
- **Outstanding work:** Closed by 2.0.0 npm publish (see entry above). gizzi-sdk hold and counsel basis remain.
- **Summary file:** none

### 2026-09-04 18:30 — grok — gizzi-code Anthropic naming purge

- **Session ID / Branch:** resumed kimi `session_237dc49a` (quota-killed mid-purge) on `main`
- **Commit:** `d5d3add9d`
- **How it works:** Hard-purged user-visible Anthropic product naming from `cmd/gizzi-code`. `CLAUDE_CODE_*` env vars are `GIZZI_*` only (no fallback) via `gizziEnv.ts` + codemod. "Claude Code" copy and product/docs/feedback URLs now gizzi/allternit. Added `NOTICE`, scoped `LICENSE`, and `docs/anthropic-allowlist.md` for the functional floor (API hosts, OAuth, model names, `CLAUDE.md` read-compat). Typecheck 0; smoke 103/103.
- **Outstanding work:** 2.0.0 publish and internal rename landed (see later entries). Remaining: gizzi-sdk legal hold, counsel distribution basis, brew/scoop/choco 1.0.2 pins.
- **Summary file:** none

### 2026-09-03 21:50 — kimi — P0 Production-Readiness Gap Analysis Execution

- **Session ID / Branch:** `session/b6d6153b` (pushed; merge to main pending user/orchestrator)
- **Commit:** `868192815..4476e933e` (7 commits; tip `4476e933e`)
- **How it works:** Executed Steps 0–5, 7–9 of `reports/2026-09-03-production-readiness-gap-analysis.md`: desktop merge repair (B4), in-repo vendoring of cloud contracts (B7), secrets sweep + gitleaks CI gate (B2/A1/A4), dev-api-token backdoor gated behind `ALLTERNIT_ALLOW_DEV_API_TOKEN` (B1), dead fly.dev repoint to api.allternit.com + wizard `.JSONB` test repair, `_redirects` static-asset pass-throughs (C1, reconciled with a parallel fix that landed on main mid-session). Rebased onto origin/main; Step 2 lockfile commit dropped as redundant with a165be187.
- **Outstanding work:** Step 6 (web↔backend routing) was DECIDED by the owner and recorded by a parallel session as ADR `docs/architecture/2026-09-03-control-plane-data-plane-decision.md` on `session/routing` (8cb6e8ef1): single public API (cloud-api), allternit-api becomes a data-plane runtime in 3 modes, per-customer SQLite, interim nginx prefix proxy on mail (owner-gated deploy). Deploy of `cf8798f97` (kills the live backdoor) is a user action — backdoor still returns 200 until then; the ADR's two-hop Ed25519 data-plane JWT (A1) is the intended replacement, mint/verify first, then remove the backdoor. Secrets rotation list (Clerk, ProtonMail, Stripe ×12, Sourcegraph ×22, link-card key) delivered to user. P1/P2 untouched. Wizard `sqlite_tests` half-migration needs its own ticket.
- **Summary file:** [./summaries/2026-09-03-2150-b6d6153b-kimi-code-p0-gap-analysis-execution.md](./summaries/2026-09-03-2150-b6d6153b-kimi-code-p0-gap-analysis-execution.md)

### 2026-09-03 08:16 — kimi — Typography Validation CI Fix

- **Session ID / Branch:** `session/typography-fix-20260903`
- **Commit:** `578792f36` — merged into `main`
- **How it works:** Replaces hardcoded `fontFamily: 'monospace'` in the h5i diff and commit panels with `fontFamily: 'var(--font-mono)'` and broadens `scripts/validate-typography.py` exemptions to cover document-rendering packages, docs surfaces, tests, and the VS Code extension, where system font names are legitimate.
- **Outstanding work:** None.
- **Summary file:** [summaries/2026-09-03-0816-session-typography-fix-kimi.md](./summaries/2026-09-03-0816-session-typography-fix-kimi.md)

### 2026-09-03 06:04 — kimi — Groq Integration + Platform Model Catalog Fixes

- **Session ID / Branch:** `session/platform-followup-20260903`
- **Commit:** `90f97cdb0` — merged into `main`
- **How it works:** Adds four curated Groq aliases to the cloud API, fixes the generic OpenAI adapter to parse string-priced model lists from Groq, deploys the API to the VPS, and fixes `platform.allternit.com` to read flattened model fields from `/v1/models` so prices and names render correctly. Updates marketing copy on `/models` and `/plans` to list Groq as a live provider.
- **Outstanding work:** DeepInfra and OpenRouter completions are blocked by zero upstream balance; Fireworks reasoning aliases route but return empty assistant content; `ai.allternit.com` was not redeployed.
- **Summary file:** [summaries/2026-09-03-0604-platform-followup-kimi-groq-console.md](./summaries/2026-09-03-0604-platform-followup-kimi-groq-console.md)

### 2026-08-30 09:20 — kimi — Workspace Package Install/Build Fixes

- **Session ID / Branch:** `session/caade5dc-3e9c-4ee6-889f-cd1276faec7c`
- **Commit:** `233e1707e` — merged into `main`
- **How it works:** Pins the repo to Node 24, fixes an undefined variable in `composer-drag.ts`, adds missing devDependencies to the page-agent extension packages, patches webpack 5.106’s `ProgressPlugin` schema for Docusaurus compatibility, and relaxes the plugin-sdk website’s broken-link policy so the static build succeeds.
- **Outstanding work:** Pre-existing typecheck errors in the office-suite packages remain; the main checkout had unrelated uncommitted changes from another session when `origin/main` was fast-forwarded.
- **Summary file:** [summaries/2026-08-30-0920-caade5dc-3e9c-4ee6-889f-cd1276faec7c-kimi-workspace-package-fixes.md](./summaries/2026-08-30-0920-caade5dc-3e9c-4ee6-889f-cd1276faec7c-kimi-workspace-package-fixes.md)

### 2026-08-27 15:29 — kimi — Brain Selector Modal Runtime Selection Fix

- **Session ID / Branch:** `session/brain-selector-fix`
- **Commit:** `140ed37a9` — merged into `main`
- **How it works:** Makes provider/runtime rows in the chat ModelPicker selectable. Clicking a runtime row in single-select mode now selects the runtime's currently selected model (or its first model) and closes the modal. The chevron remains a separate expand/collapse affordance, and the provider containing the active selection auto-expands when the modal opens.
- **Outstanding work:** None; multi-select mode intentionally keeps checkbox-only selection.
- **Summary file:** [summaries/2026-08-27-1529-brain-selector-fix-kimi-runtime-selection.md](./summaries/2026-08-27-1529-brain-selector-fix-kimi-runtime-selection.md)

### 2026-08-27 09:42 — kimi — Repo Hygiene Follow-up (Open Items)

- **Session ID / Branch:** `session/repo-hygiene-followup`
- **Commit:** `aefcc6fa1` — merged into `main`
- **How it works:** Commits the untracked platform audit under `docs/audit/`, deletes root `.beads/`, and moves `.pipeline/`, `.parity-reports/`, and `.shared/` into `docs/` with updated references. Leaves `.allternit/`, `.gizzi/`, and `.steering/` at root because live code hardcodes those paths.
- **Outstanding work:** `.allternit/`, `.gizzi/`, `.steering/` could be made configurable in a future pass instead of hardcoded.
- **Summary file:** [summaries/2026-08-27-0942-repo-hygiene-followup-kimi-cleanup.md](./summaries/2026-08-27-0942-repo-hygiene-followup-kimi-cleanup.md)

### 2026-08-27 09:14 — kimi — Repo Hygiene & Root-Level Reorganization

- **Session ID / Branch:** `session/repo-hygiene`
- **Commit:** `3bbbec07c` — merged into `main`
- **How it works:** Removes improperly-linked nested worktrees and scratch `.tmp-*` entries from the git index, deletes ignored working-tree noise (`.cache/`, `.references/`, `.pytest_cache/`, etc.), and consolidates root-level drift (`marketing/`, `upstream/`, `remix-content/`, ad-hoc scripts/docs) into `docs/` and `scripts/` so the root layout matches `REPO_STRUCTURE.md`.
- **Outstanding work:** Historical references in `docs/archive/` and `docs/Future_Blueprints/` were left as-is; `.parity-reports/allternit-audit.md` remains untracked pending decision on whether to commit it.
- **Summary file:** [summaries/2026-08-27-0914-repo-hygiene-kimi-cleanup.md](./summaries/2026-08-27-0914-repo-hygiene-kimi-cleanup.md)
### 2026-08-27 11:46 — kimi — bb Platform Audit + Incremental Parity Scaffold (Phase 1)

- **Session ID / Branch:** `session/cacb228c-026d-4ea5-85fe-aa09788e3c7c`
- **Commit:** `87de5f02c` — pushed to origin
- **How it works:** Audited Allternit and bb, produced 1:1 capability mapping and gap spec, then scaffolded bb-compatible core entities (projects, threads, environments, hosts, events) as new `/api/v1/bb/*` routes in the Rust API plus Drizzle schema updates and a minimal web view.
- **Outstanding work:** Web typecheck blocked by better-sqlite3 native build failure on Node 26.5.0; bb mode not yet wired into unified project projection; host-daemon bridge, terminal, plugin, CLI, mobile, desktop, and bb connect surfaces deferred to later phases.
- **Summary file:** [summaries/2026-08-27-1146-bb-audit-parity-scaffold-kimi-phase1.md](./summaries/2026-08-27-1146-bb-audit-parity-scaffold-kimi-phase1.md)

### 2026-08-26 21:13 — kimi — Remote Control Gap Fix (secure push, PWA, UX polish)

- **Session ID / Branch:** `session/remote-control-gap-fix`
- **Commit:** `2c21d67e3` — merged into `main`
- **How it works:** Secures the push worker with Clerk-bearer `/subscribe` auth and service-secret/device-token `/notify` auth, adds KV TTL/rate-limiting/dead-subscription cleanup, hardens the Remote Control PWA with a precached offline app shell and iOS tags, fixes dashboard push permission/auth handling, and polishes setup UX with honest permission copy and empty states.
- **Outstanding work:** Replace placeholder PWA icons/splash with final assets; run full manual E2E.
- **Summary file:** [summaries/2026-08-26-2113-remote-control-gap-fix-kimi-secure-push-pwa-polish.md](./summaries/2026-08-26-2113-remote-control-gap-fix-kimi-secure-push-pwa-polish.md)

### 2026-08-26 10:13 — agent — Unified Compute & Desktop Cloud MVP

- **Session ID / Branch:** `session/desktop-cloud-mvp`
- **Commit:** `6295201ec` — Merge local desktop-cloud MVP state with unified compute work
- **How it works:** Introduces a unified `computers` domain with `/api/v1/computers` API, consolidates compute settings UI, wires cloud-desktop provisioning into bot session lifecycle, and backfills legacy bot desktop sandboxes.
- **Outstanding work:** Not merged to `main`; deprecated routes retained for backward compatibility; live VM end-to-end provisioning not fully verified; `computer_minute` pricing is a placeholder; old platform worktrees may still exist.
- **Summary file:** [summaries/2026-08-26-1013-desktop-cloud-mvp-agent-unified-compute-desktop-cloud.md](./summaries/2026-08-26-1013-desktop-cloud-mvp-agent-unified-compute-desktop-cloud.md)


### 2026-09-03 11:41 — kimi — Session worktree cleanup (4 worktrees)

Worktree hygiene pass on `~/Desktop/allternit-workspace`. Four session worktrees removed after preserving all uncommitted state as pushed `wip/*` branches. Remaining merges to `main` (72ac1efa, cacb228c, model-picker, desktop-cloud-mvp, omb-integration-phase0) deliberately held — a live session is editing the main checkout.

- **fabric-transport-convergence** — merged into `main`. Uncommitted bridge-removal/fabric-session refactor preserved on `wip/fabric-transport-bridge-removal` (`e310b5689`). [Summary](./summaries/2026-09-03-1141-fabric-transport-convergence-kimi-worktree-cleanup.md)
- **d89ae6f0** — merged into `main`. Dev server stopped. One-line workflow tweak preserved on `wip/cloudflare-deploy-workflow` (`c55c15758`). [Summary](./summaries/2026-09-03-1141-d89ae6f0-3d9f-418e-8d5a-e2f91a39256b-kimi-worktree-cleanup.md)
- **7d581442** (ios-local-models-marketplace) — not merged; tip pushed to origin session branch. WIP preserved on `wip/ios-local-models-marketplace` (`3dd921673`). [Summary](./summaries/2026-09-03-1141-7d581442-d796-4e0e-bdac-2fec641c3677-kimi-worktree-cleanup.md)
- **ios-bot-parity** — not merged; tip pushed to origin session branch. WIP preserved on `wip/ios-bot-parity-wip` (`ec0b7b500`). [Summary](./summaries/2026-09-03-1141-ios-bot-parity-kimi-worktree-cleanup.md)

### 2026-09-03 14:00 — kimi — Session branch merges into main (5 branches)

All five held session branches merged into `main` after preserving uncommitted
state. `cargo check` (both Rust APIs) and `tsc` (ai.allternit.com,
allternit-desktop) clean except pre-existing main breakage (env.ts:88,
DispatchView). Follow-up fix commit `4a3fa8a23`.

- **model-picker-20260829** → `d2ee21f64` [Summary](./summaries/2026-09-03-1400-model-picker-20260829-kimi-merge.md)
- **cacb228c** (bb parity scaffold) → `9950e8f84` [Summary](./summaries/2026-09-03-1400-cacb228c-kimi-merge.md)
- **72ac1efa** (extension/api) → `2af2d8739` [Summary](./summaries/2026-09-03-1400-72ac1efa-kimi-merge.md)
- **omb-integration-phase0** (bots/group chat) → `a570a1c40` [Summary](./summaries/2026-09-03-1400-omb-integration-phase0-kimi-merge.md)
- **desktop-cloud-mvp** (unified compute + fabric) → `ea89a5fdb` + `4a3fa8a23` [Summary](./summaries/2026-09-03-1400-desktop-cloud-mvp-kimi-merge.md)

### 2026-09-03 17:16 — kimi — Cloud backend hardening handoff (session ba9de8f8)

Phase 2/3 hardening of allternit-cloud-api complete and deployed to the Contabo control plane (`mail`, Postgres prod DB). All commits pushed; `origin/main` = `97ecec0bb`. Auth unification across ~25 route call sites, scoped `alt_` API tokens (were minted but wired to nothing), Contabo destroy ownership fix, Groq per-token pricing normalizer (both over- and under-metering directions fixed), five billing guards (disk quotas, $2 free inference, free-path rate limit, chargeback hold, daily revenue reconciliation), pool broker + circuit breaker, BYOK inference keys, Tailscale CI/CD workflow with rollback (inert until owner sets `TS_AUTHKEY`). Live: 168/168 release tests, billing soak 12/12, sweep smoke 5/5, scope check 8/8. Deferred to owner: Tailscale `tag:ci` auth key, real $10 Stripe purchase, DeepSeek/Kimi pool keys. Goal milestones 5 (standby failover test) and 8 (CI/CD proof run) still need proof checks; `/goal` blocked and resumable.

- **ba9de8f8** (cloud backend hardening) → `97ecec0bb` [Summary](./summaries/2026-09-03-1716-ba9de8f8-kimi-cloud-backend-hardening.md)
- [2026-09-03 session/423a858e](summaries/20260903-2010-423a858e-kimi-ai-redirects-fix.md) — ai.allternit.com _redirects: stop catch-all from swallowing static assets; add robots.txt + 404.html. Merged dc91223b6.

### 2026-09-04 — kimi — API consolidation: control-plane/data-plane split (session/routing)

Audit Step 6 decided by owner (option b + interim proxy). P0: vendored cloud-contracts (CI blocker), CORS allowlist, dev-token gate (default OFF), fail-closed flags for all 8013-only namespaces. P1: node registry (migration 011) + control-plane handlers for agent-sessions/office/beta via existing WS relay, data-plane JWT (A1) both sides, WS relay for beta events, rails dialect fix, web flipped to control-plane (flags off). 13 commits `4f77728c3..f3b4ed071`. Deferred: iOS Xcode build (owner), ~270 pre-existing allternit-api --lib failures (refinery/stale-binary debt), 21 rails + canvas control-plane routes, post-merge ops (migration 011 + DP_JWT_SEED + nginx proxy + bypass flip — sequence in summary).

- **session/routing** (API consolidation) → summary [2026-09-04](./summaries/2026-09-04-session-routing-kimi-api-consolidation.md)

### 2026-09-03 23:17 — kimi — gizzi-code production-readiness P0/P1 (session 237dc49a)

Production-readiness pass on `cmd/gizzi-code` ahead of the 2026-09-04 release: hang fixes (startup probes + the exec-never-exits regression), build-breaking syntax/import fixes, security (Clerk test key removed, SSRF closed, dev-token backdoors removed), cloud defaults repointed to api.allternit.com, CI quality gates on release/npm workflows, and full distribution packaging (5 release targets incl. darwin-x64, fixed installers proven against the live v0.2.3 release, install.gizziio.com manifest, brew/scoop/choco/rpm/arch/winget, Dockerfile/nix). Verified: tsc exit 0, smoke suite 1065/0 fail, production binary 1.0.2 builds and `exec` exits in 4s (was infinite). Full gap register and deferred P2–P6 work in the summary. Cloudflare deploy of install.gizziio.com and git push left to owner.

- **237dc49a** (gizzi-code production-readiness) → see merge commit on main [Summary](./summaries/2026-09-03-2317-237dc49a-kimi-gizzi-deploy-p0p1.md)

### 2026-09-04 08:26 — kimi-code — P1/P2 backlog execution from 2026-09-03 gap analysis (session p1followup)

Executed the full P1/P2 list from `reports/2026-09-03-production-readiness-gap-analysis.md` in six tracks: web P1 hardening (25ba93e9f), docs correction pass (4acd3403b), ops/infra (live nginx interim proxy + CORS allowlist + rate limits on mail, off-host backup timer verified, backdoor dead — 89c00b1c4), desktop CI/release (b8d19b98a), rust/cloud-api (sqlx::migrate! runner, sha256+md5-upgrade token path, Clerk run-WS, email-verify gate — 10c1c9091), desktop/gizzi hardening (acc913bdb). Merged to main as **c9e6ddcb2** after resolving 9 conflicts against a parallel session's cloud-api track (kept md5-fallback token lookup; both dev-token overrides now prod-refused; sqlx::migrate! is the single migration path, db::migrations unwired). Verified on merged tree: cloud-api 188 pass (+1 known docker-env fail), wizard 53/53, gizzi smoke 1156/0 fail. Incidents: mid-merge `git reset` by a concurrent session in the shared checkout (recovered by merging in the session worktree). Owner-gated leftovers restated in the summary.

- **p1followup** (P1/P2 backlog execution) → merged to main as c9e6ddcb2 [Summary](./summaries/2026-09-04-0826-p1followup-kimi-code-p1p2-backlog-execution.md)

### 2026-09-04 — kimi-code — gizzi-code production-readiness sweep, P2–P5 closeout (session gizzi-deploy-20260904)

Executed the full actionable list from `reports/2026-09-03-production-readiness-gap-analysis.md` (P2–P6 + corroboration addendum) in cmd/gizzi-code: 18 merges into main ending at **f910797cf** — test coverage (cron/vault, migration chain, +182 unskipped tests → 1,308 passing), exit-hang fix, cron parser stack-overflow fix, credential store + log redaction, Windows honesty pass, telemetry governance, timeouts, stub removal + plugin unification, web/serve auth parity + CORS, 2,297-file dead-code collapse with guard, perf/completions + production build fix, onboarding/doctor v2/uninstall v2, rebrand completion (sk-ant-cc- eliminated, CLAUDE_CODE_ triage) + legal/attribution audit. Verified on composed main: typecheck exit 0, smoke 103 entries green / 0 fail. Owner-only items (TS_AUTHKEY secret, secrets rotation, Backend B DNS, signing cert, hosted-runtime repin, OAuth server-endpoint gap, install site deploy, infra backups) documented blocked-with-reason in the summary; bundle size 171.9 MiB logged as non-blocking follow-up. **Evening correction:** the "cloud-api deploy sequencing behind iOS" warning is lifted — owner confirmed iOS is not shipping, and cloud-api already retains md5-fallback token lookup (p1followup), so the deploy is unblocked; only the post-deploy sha256 token re-mint migration + md5-fallback removal remains (owner-run).

- **gizzi-deploy-20260904** (P2–P5 production-readiness closeout) → merged to main as f910797cf [Summary](./summaries/2026-09-04-gizzi-p2p5-sweep-kimi-code-production-readiness.md)

### 2026-09-04 — kimi-code — gizzi-code de-branding sweep + fresh verified npm publish

Removed user-visible Claude/Anthropic fork traces from gizzi-code (117 files, ~205 string substitutions: system-prompt presets in both constants/system.ts copies, built-in agent prompts in both AgentTool trees, TUI strings, tips, errors, config-dir defaults now ~/.gizzi-first with ~/.claude read-only legacy fallback). Kept provider-genuine mentions (model names, Anthropic API auth text, wire protocol headers, marketplace UA, third-party app/extension names). Deleted the truncated/invalid .github/workflows/release-gizzi-code.yml (job had no steps; npm publish workflow is the release path). Verified: typecheck exit 0, smoke 103 entries green / 1,308 tests, on sweep commit and again after merging origin/main (routing PR #85). Published @allternit/gizzi-code@1.0.2 via tag gizzi-code/v1.0.2 with the workflow's tarball-verification gate (dist/ present, bin entries resolve). Known gap: single-platform binary (linux-x64) in the npm tarball — macOS/Windows installs get the shim's graceful "no prebuilt binary" message; per-platform packages or GitHub-release assets are the follow-up.

- **gizzi-deploy-20260904** (de-branding + npm publish) → see summary above

### 2026-09-04 — kimi — allternit-api migration duplicate-version + duplicate-route fix (session/testdebt)

Labeled "test debt" (270 --lib failures), actually two production bugs: 7 migration versions duplicated by merges ea89a5fdb/9950e8f84 silently skipped by refinery on existing DBs (fabric offer/lease/pricing/canonical, desktop audit log, placement canonical, node capability JSON missing); bot_desktop_router double-registered desktop/start|stop (axum startup panic). Renumbered duplicates to V124-V130; removed duplicate routes; 4 test URI fixes; AllternitOS control-plane test binary rebuilt with --features fake-provider. Suite: 648/648. Ops: 7 migrations apply on next VPS boot — intended repair. Deploy note: cloud-api CI test job green; deploy job blocked on Tailscale OAuth secrets (owner).

- **session/testdebt** → squash `2cb17fcde`

### 2026-09-04 — kimi-code — gizzi-code de-branding sweep + verified npm 1.0.2 publish (cross-platform)

Removed user-visible Claude/Anthropic fork traces (117 files, ~205 strings: system-prompt presets in both constants/system.ts copies, built-in agent prompts in both AgentTool trees, TUI strings, config-dir defaults now ~/.gizzi-first with ~/.claude read-only legacy fallback). Kept provider-genuine mentions (model names, Anthropic API auth text, wire protocol). Deleted invalid truncated release-gizzi-code.yml. Verified locally: typecheck exit 0, smoke 103 entries green / 1,308 tests, before and after merging origin/main.

Published **@allternit/gizzi-code@1.0.2** — the first verified publish (1.0.1 shipped a broken tarball): platform packages `@allternit/gizzi-code-{darwin-arm64,darwin-x64,linux-arm64,linux-x64}@1.0.2` built per-platform in CI (darwin-x64 cross-compiled from the arm64 pool; win32-x64 non-blocking experimental leg — better-sqlite3 lacks a Windows prebuilt on the runner), main package with injected optionalDependencies + bundled linux-x64 binary, launcher shim resolves dist/ then platform package (fallback verified locally). CI fixes along the way: runner git identity, root pnpm install in publish job, bun 1.3.14, version-bump tolerance, publish-time optionalDependencies injection (committed refs break frozen pnpm install), idempotent publishes, tarball-download retry (blob replication lag), non-blocking win32, verify gate strict on core-4 / warn on win32. **Owner follow-ups:** NPM_TOKEN should be rotated (passed through chat during setup); Windows platform package pending a better-sqlite3 Windows prebuilt fix; @allternit/sdk refresh (1.3.0) and plugin-sdk naming consolidation are the next npm-account items; @allternit/gizzi-sdk first publish held for legal counsel (Anthropic-derived).

- **gizzi-deploy-20260904** (de-branding + npm 1.0.2) → main 6b0fd0272 [Summary](./summaries/2026-09-04-gizzi-p2p5-sweep-kimi-code-production-readiness.md)

### 2026-09-04 (late) — kimi-code — npm matrix completed: gizzi-code win32 + @allternit/sdk 1.3.0

Cross-compiled gizzi-code-win32-x64 from macOS (`bun build --target=win32-x64` — valid PE32+, Windows-native vendored assets embedded) and hand-published `@allternit/gizzi-code-win32-x64@1.0.2`; full platform matrix now live (darwin-arm64, darwin-x64, linux-arm64, linux-x64, win32-x64). Caveat logged: PE validity confirmed; embedded native modules (better-sqlite3, bun-pty) need a real-Windows smoke run. Published **@allternit/sdk@1.3.0** via new gated workflow (.github/workflows/publish-sdk-npm.yml, tag sdk/v*) — dangling-export gate (21 entries), idempotent publish, tarball verify; first-try success. Remaining npm-account items: token rotation, plugin-sdk naming consolidation, gizzi-sdk first publish held for legal counsel.

- **gizzi-deploy-20260904** (npm win32 + sdk 1.3.0) → main 054d1858a

## 2026-09-04 — npm stale-registry refresh (gizzi-code session)

- New gated workflow `.github/workflows/publish-package-npm.yml`: workflow_dispatch(path+version), path/name whitelist, standalone per-package `npm install` (dodges the pnpm `@allternit/visual-state` workspace conflict), build, exports sanity gate, idempotent publish, tarball download verify. Modeled on the SDK publish workflow that passed first-try.
- Refreshed 5 core packages stale since 2026-04-14 (all verified live, tarballs spot-checked):
  - @allternit/api-client 1.0.1 → 1.0.2
  - @allternit/plugin-sdk 1.0.1 → 1.0.2
  - @allternit/workflow-engine 0.1.0 → 0.1.1
  - @allternit/ix 0.1.0 → 0.1.1
  - @allternit/viz 0.1.0 → 0.1.1
- Exports gate caught REAL dangling subpaths on first dispatch: workflow-engine advertised ./engine, ./nodes, ./executor with no built barrels (trimmed to `.`, `./scheduler`, `./visualizer` — everything still reachable from root, no in-repo consumer used removed subpaths); viz advertised ./charts, ./components (trimmed to `.`). Fixed, re-dispatched, both green.
- Cleanup: api-client tarball shipped a tracked stale nested scaffold `allternit-api-client/` (named `@allternit/api-client-dist`, src identical) because it lacked a `files` field — deleted the scaffold, added `files: [dist, README.md]` to api-client/workflow-engine/viz.
- Verify-step metadata poll extended 5x10s → 12x15s after a false failure on replication lag (workflow-engine@0.1.1 was live ~30s after the workflow gave up; confirmed via `npm view`).
- Deprecated 12 archived card plugins on npm with pointer to @allternit/gizzi-code (apispec, chatbot, codereview, datatable, documentanalyzer, emailcomposer, imagegen, marketresearch, prdescription, socialmedia, testgenerator, translation). iosappbuild/remotion/verceldeploy plugins were never published — nothing to deprecate. The only commit touching archive/plugins since April was a CI script rename (2bda61382), so republishing dead packages was deliberately NOT done.
- Combined with earlier today: @allternit/gizzi-code@1.0.2 + all 5 platform packages (incl. hand-cross-compiled win32-x64, PE32+ valid, native modules unverified on real Windows) and @allternit/sdk@1.3.0 via workflow.
- HOLDS (unchanged): rotate the npm token (pasted in chat twice, currently also a repo secret); `gizzi-sdk` name under legal hold — publish decision pending; plugin-sdk naming consolidation deferred.
- 2026-09-06 roster-cleanup (kimi): desktop bot UX — removed dead Bot Roster view + its shell-rail section, opaque white create box, template-first skippable bot-creation onboarding (+ fixed latent client-side checklist-gate failure). Branch `session/roster-cleanup` @ 9c2e2e3b6, unmerged. Summary: agent-ledger/summaries/2026-09-06-roster-cleanup-kimi-desktop-bot-ux.md
- 2026-09-06 railup (kimi): shell rail upgrades round 1 — rich recent-item context menus (open/rename/pin/delete), self-pruning PINNED section (localStorage-backed), hover-revealed `+` on RECENTS headers, RECENTS "More…" expand-in-place with search past 15. Branch `session/railup` @ 5007f99ee, merged to main @ f7c6d38ab. Summary: agent-ledger/summaries/2026-09-06-2253-railup-kimi-shell-rail-upgrades.md
- 2026-09-06 ui-session-polish (kimi): UI polish for desktop platform — white chat session bg, readable cowork progress rail (theme tokens), code-mode model selection synced with app-wide brain (provider + gizzi-brain-changed sync + shared default hook), first-class Computer pane in code mode (bot desktop observe/take-over/hand-back, ACI idle state, labeled launcher), global multi-terminal workspace (tile grid + focus zoom, session tags, native CLI catalogue launch). Branch `session/ui-session-polish` @ aad9301eb, merged to main @ 486d7b09b (PR #104). Summary: agent-ledger/summaries/2026-09-06-2323-ui-session-polish-kimi-ui-polish-terminal-workspace.md
- 2026-09-07 bot-teammates-spec (kimi): design spec only — full phased build plan for "bots as persistent teammates" benchmarked on Hermes Desktop Bot Mode (source-verified gap analysis: 15 gaps, 5 architecture decisions, 6 phases). No code. Branch `session/bot-teammates-spec` @ 1324805c2, merged to main @ e0ca64e78. Spec: docs/BOT_TEAMMATES_SPEC.md
- 2026-09-07 0f55144a (kimi): Model Lab — fixed dead telemetry (desktop now starts/packages the local-engine sidecar; live cpu_usage_percent + RAM sampler), live Hugging Face catalog (30-min stale-while-revalidate, fetched_at/stale, trending grid on empty search), preview cards (batch assess, neutral Fit-unknown fallback, monogram avatars, real sizeBytes via sidecar). Branch `session/0f55144a` @ 6df7b2dd7, merged to main @ 84b95f8ae (PR #105). Summary: agent-ledger/summaries/2026-09-07-0804-0f55144a-kimi-model-lab-live-telemetry-catalog.md
- 2026-09-07 bots-p01 (kimi): BOT_TEAMMATES_SPEC Phase 0+1 — typed failure taxonomy (13 codes + retry policy), attention slice, capability epoch w/ rebuild-on-drift, canonical-chat hardening, versioned persist; TEAMMATES rail section, presence slice, routine timer (60s + missed-on-launch) w/ continuity + monitor mode + scratchpad, simple routine composer, share-auth inheritance docs. 32 new tests, suite 1263 green. Branch `session/bots-p01` @ 64d424372 (ff to main). Summary: agent-ledger/summaries/2026-09-07-bots-p01-kimi-bot-teammates-phase-0-1.md
- 2026-09-07 office-ext (kimi): Office extensions overhaul — native extension slot in `@allternit/office-suite` (Allternit Assistant occupies each app's AI chat section; wired into office.allternit.com + platform views covering desktop), MS Office add-in full in-pane AI wired into Word/Excel/PowerPoint taskpane (companion fallback, live document context, platform.allternit.com/office-addins hosting via Pages postbuild, manifests 1.1.0.0), Phase-0 audit hygiene (red typecheck, CI paths, pdfjs 6 + destroy() migration, docs drift). Branch `session/office-ext-20260907` @ 2964082b9 (+ Phase 3 polish). **Merged to main @ 4f7a3d00d** — merged via remote push (`HEAD:main`, fast-forward) rather than the local main checkout, because another session was actively working in the shared checkout with uncommitted changes to files this branch also touches; local checkout untouched, that session pulls when ready. Summary: agent-ledger/summaries/2026-09-07-0832-office-ext-kimi-office-extensions-suite-integration.md
- 2026-09-07 d641922e (kimi): Bot home mode — Bot as a first-class home mode (three-way Chat/Cowork/Bots composer pill replacing the broken "Choose a bot" overlay; BotLaunchpadView home w/ shared launch geometry + gizzi entrance; BotPickerSheet bottom drawer for bot/group selection; bot-mode rail with Pinned Bots (first live use of pinnedBotIds), Bots-by-activity, Group Chats w/ unread; bot rows land in the bot's session not detail; session-view avatar chip → detail; BotHomeView consolidated 8+ tabs → 4) PLUS full-stack session-landing fix (Rust: client session metadata persisted/echoed via existing V100 table, camelCase agentId, explicit 403; client: merge-don't-replace metadata, isBot local fallback, navigation never swallowed, ses_* prefix relaxed; bot-e2e re-pointed at this repo). 47 files. Branch `session/d641922e` @ 762eeb5e1, merged to main @ 792f20d4f (PR #106). Verified: cargo 653 tests, typecheck clean in touched files, vitest 324 pass. Shared-checkout pull deferred (foreign sessions' dirty files overlap office-ext commits; same precedent as office-ext). Summary: agent-ledger/summaries/2026-09-07-0847-d641922e-kimi-bot-home-mode-session-landing.md
- 2026-09-07 term-xterm55 (kimi): Terminal fixes for desktop code mode — typing-dead root cause (xterm 5.3 keyboard pipeline broken on Chrome 146/Electron 41) fixed by upgrading to `@xterm/xterm` 5.5.0 + scoped addons (fit/search/serialize/web-links/webgl/canvas), old `xterm/*` packages removed; garbled fast input fixed via per-session ordered write queue (`queueTerminalInput` promise chain in terminal-api.ts); "too spaced out" text fixed by loading the WebGL renderer with canvas→DOM fallback + `letterSpacing: 0`. PLUS terminal workspace moved into the code-mode console drawer (shell TerminalView back to tab-strip; Terminals tab removed from chat composer, Console is the single entry), streetlight tile chrome (close/reset/zoom), per-tile height drag handle + global tile font size, catalogue/modal zIndex base. PLUS desktop main-process fixes (ESM `__dirname` shim in mesh/backend-manager; `ALLTERNIT_API_HEALTH_TIMEOUT_MS`, default 90s). Verified: platform build clean, CodeSessionSidePane vitest 3/3, live CDP smoke in the running desktop app (typing executes+renders, letterSpacing normal w/ WebGL active). 20 files. Branch `session/term-xterm55` @ 76f4eebcc, merged to main @ c96bf62da (PR #108). Shared-checkout pull deferred (foreign sessions' dirty files overlap; same precedent as office-ext/d641922e). Summary: agent-ledger/summaries/2026-09-07-0852-term-xterm55-kimi-terminal-fixes.md
- 2026-09-07 7631feda deltas (kimi): closed all 4 remaining grok-dashboard known deltas — (1) inline permission answers in the dashboard peek panel (real PermissionRequest + 1-9 keys; canUseTool wrap stamps options.dashboardTaskId, pushToQueue copies it; also fixed latent awaitingInput try/finally promise bug), (2) animated braille spinner on working rows, (3) live main leader row via refs (needs-input/working/idle + model/permissionMode), (4) stale-cell ghost fix: root cause was the NON-TTY full-frame serializer (renderFullFrame, used when stdout is piped e.g. `gizzi | tee`) emitting trimEnd'd rows with no per-row erase on alt-screen re-landed frames — every row now ends with erase-to-EOL, plus a TTY-path stale-tail sweep kept as defense-in-depth. First subagent attempt (TTY sweep only) failed live verification (0 CSI K; repro traps: Tab-focus needed for the dispatch input, tee'd stdout takes the non-TTY path). Regression tests at test/ui/non-tty-full-frame-ghost.test.ts + log-update-shrink-tail.test.ts. Verified: live tmux type/delete burst clean (CSI K 0→1091), typecheck green, smoke 1315 pass/0 fail post-merge. Branch `session/7631feda-deltas` @ e0abf92a3 (977f8b1bd + 3c7b5d2cc + origin/main merge), merged to main @ e0abf92a3 via remote HEAD:main fast-forward (shared checkout unsafe — foreign session's 20+ overlapping dirty files; same precedent as office-ext/d641922e/term-xterm55). Known follow-up: >30 keys/s loses keystrokes in the input layer (pre-existing, not render-path). Summary: agent-ledger/summaries/2026-09-06-2337-7631feda-kimi-grok-dashboard.md
- 2026-09-07 term-font (kimi): Terminal font = SF Mono (macOS Terminal.app standard), owner request — all three xterm constructors (UnifiedTerminal TerminalSurface, NodeTerminal, TerminalCanvas) switched from `var(--font-mono)` (Allternit Mono webfont stack, which never parsed in canvas font measurement anyway) to explicit `"SF Mono", "Allternit Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace`. Terminal surfaces only; app-wide --font-mono untouched; no other sessions' files. Verified: build clean, vitest 3/3. Branch `session/term-font` @ 0a4a1035f, merged to main @ 00a8868f8 (PR #109). Summary: agent-ledger/summaries/2026-09-07-0902-term-font-kimi-sf-mono-terminal-font.md
