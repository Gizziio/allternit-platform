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
