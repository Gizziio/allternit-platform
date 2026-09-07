# Allternit Platform — Production Readiness Gap Analysis
**Date:** 2026-09-03 (day before announced production launch)
**Scope:** ai.allternit.com (web platform) + Allternit Desktop (app, distribution, and packaging) + supporting backend (allternit-cloud-api, allternit-api), Allternit Cloud product integration, and gizzi-code.
**Method:** 7 parallel read-only audits across the monorepo at `/Users/joe/Desktop/allternit-workspace/allternit`, with live probing of production endpoints (curl), CI state (gh), npm registry, and local build/typecheck runs. Every claim below carries evidence. Each finding lists a **Verify** command so a second agent can corroborate independently.
**Repo state audited:** `main` @ `88baa91ab` (1 docs commit ahead of `origin/main` @ `97ecec0bb`, unpushed).

---

## Executive Summary

| # | Area | Grade | One-line verdict |
|---|------|-------|------------------|
| 1 | Web surface — `surfaces/ai.allternit.com` | D+ | Build/deploy pipeline works and auth fail-closed design is sound — but carries committed credentials, dead API routes, shipped debug pages, and zero observability |
| 2 | Backend — `cmd/allternit-cloud-api` (api.allternit.com) | C+ | Real, tested infra (CI/CD, failover, billing guardrails) — undermined by a live auth backdoor, MD5 token hashing, and no migration runner |
| 3 | Backend — `cmd/allternit-api` (port 8013, desktop-cloud) | C | Comprehensive migrations and gated local bypass — but CORS mirrors any origin, and its routes are unreachable from the web surface in production |
| 4 | Distribution & packaging — `../distribution` | D | Dead scripts referencing a `7-apps/` layout that no longer exists; no artifact ever produced |
| 5 | Desktop app — `surfaces/allternit-desktop` | F | Main process does not typecheck (bad merge today, `ea89a5fdb`) and would crash at startup on duplicate IPC registrations |
| 6 | Cloud product & integration — Allternit Cloud | D | Real, hardened billing/inference core — but verified live auth backdoor, two red deploy pipelines, broken web cowork path, dead fly.dev defaults |
| 7 | gizzi-code — `cmd/gizzi-code` | D+ | Core runtime builds, boots, and is feature-rich — but the only live distribution channel (npm) ships a broken package and there is no working update mechanism |
| 8 | Cloud & infrastructure — VPS/CF/DNS/observability | C | Genuine deploy automation + tested failover — but no DB backups, unprovisioned CI secret, spoofable-origin auth bypass in shipped env template |

**Overall: D+** — the web platform is launchable tomorrow only after the P0 list; the desktop is not shippable in any form (app doesn't compile, no installer, no repos, no signing).

**The three blockers that matter most:**
1. A hardcoded `dev-api-token` grants wildcard permissions on production api.allternit.com — **verified live by curl**.
2. A production test-account password is committed in git (`TESTING.md:6`).
3. The web app's canonical API client is wired to api.allternit.com, which 404s every allternit-api (8013) route the UI depends on — most authenticated features silently broken.

---

## Verified Blockers (confirmed against production or by running builds)

### B1. Live auth backdoor on api.allternit.com
`cmd/allternit-cloud-api/src/auth/middleware.rs:313-316` — `validate_token_against_db` accepts the literal bearer `dev-api-token` and returns `development_user()` with `permissions: ["*"]`. Not gated on dev mode. Same fallback exists in the legacy `AuthLayer` at `middleware.rs:106-108`. `["*"]` passes the admin check in `routes/model_router.rs:64-67`, so the token dispatches paid inference and manages runs/deployments. The iOS app **hardcodes this token**: `surfaces/allternit-mobile/ios/Core/API/APIClient.swift:124`, `PtyClient.swift:88`.
**Verify:** `curl -s -H "Authorization: Bearer dev-api-token" https://api.allternit.com/api/v1/auth/me` → returns `{"user_id":"dev-user","permissions":["*"]}` (confirmed 200).

### B2. Production Clerk test-account password committed in git
`surfaces/ai.allternit.com/TESTING.md:6` (and :38, :48) publishes the live password `Tyhvix-gafho2-bofxog` for `cartlidge.joseph@yahoo.com`, stated to work across all `.allternit.com` subdomains. Tracked in git since `7cc62f7ef`.
**Verify:** `git log --oneline -- surfaces/ai.allternit.com/TESTING.md` and read line 6.

### B3. Web surface wired to a backend that 404s its routes
The production JS bundle has `VITE_ALLTERNIT_GATEWAY_URL=https://api.allternit.com` baked in. `surfaces/ai.allternit.com/src/integration/api-client.ts:8-9` declares itself "the ONLY authorized way for the UI to communicate with the backend", but `/api/jobs`, `/api/v1/agent-sessions`, `/api/v1/office/cli/capabilities`, `/api/v1/beta/sessions`, `/api/rails/peers` all return **404** on api.allternit.com (only cloud-api routes live there). Relative `/api/*` calls get SPA HTML (200) via the Pages `_redirects` catch-all — silent failure.
**Verify:** `curl -s -o /dev/null -w '%{http_code}' https://api.allternit.com/api/jobs` → 404; `curl -s https://ai.allternit.com/api/v1/beta/research` → 200 text/html.

### B4. Desktop main process does not compile; would crash at startup anyway
Introduced **today** by merge `ea89a5fdb` ("Merge branch 'session/desktop-cloud-mvp'"). Desktop CI went green→red on 2026-09-03 (`gh run list --workflow ci-desktop.yml`): run 33760115033 ✅ → 33794792428 ❌ → 33796497386 ❌.
- `src/main/unified-main.ts:210/232` — `hudWindow` declared twice; `:212/215` — `remoteControlWindow` declared twice.
- `unified-main.ts:732` — `effectiveMode` referenced but never declared.
- `unified-main.ts:1436/1523/2182/2287` — duplicate `createHudWindow` / `toggleHudWindow` implementations (the two `toggleHudWindow`s disagree: one hides, one closes).
- Even if tsc passed: `ipcMain.handle` double-registers `shell:move-hud`, `shell:resize-hud`, `shell:close-hud`, `shell:toggle-hud` (`:2312/2850`, `:2335/2860`, `:2306/2870`, `:2311/2874`) — Electron throws "Attempted to register a second handler" at module load.
**Verify:** `cd surfaces/allternit-desktop && npx tsc --noEmit -p src/main/tsconfig.json` → 9 errors. `git show ea89a5fdb --stat` to see the merge.

### B5. No shippable desktop installer; every distribution endpoint is dead
- Release workflow `.github/workflows/release-desktop.yml` has **failed 3/3 runs** (Apr 18 2026; runs 24614651728, 24614762680, 24614827378). Tag `desktop-v1.0.0` exists; no GitHub release produced.
- `github.com/allternit/desktop`, `allternit/platform`, `allternit/backend` — **all 404** (`gh repo view allternit/desktop`). These are the electron-builder publish target, the auto-update feed (`unified-main.ts:152`), manifest download URLs (`src/main/manifest.ts:24-28`), README links, and the Homebrew formula target.
- Signing disabled: `package.json:268` `"identity": null`, `:348-349` `certificateFile: null`, `:356` `verifyUpdateCodeSignature: false`. `notarize.cjs:29` silently skips when secrets unset.
- Manifest checksums empty for 4 of 5 platforms (`manifest.ts:32-38`); `aarch64-macos` has a stale hardcoded checksum the release sed can't patch.
- Local packaging impossible today: `resources/bin/` (api, gizzi, voice binaries), `resources/lima/`, `resources/platform/index.html`, `resources/computer-use/cua-driver` all absent — `scripts/verify-packaged-resources.cjs` correctly fails.
- Old `../distribution` scripts are dead code: `build-app-bundle.sh:18-20`, `build-single-binary.sh:20-22`, `build-portable.sh:24-27`, `build-electron.sh:24-27` all `cd` into `7-apps/…` which does not exist.
**Verify:** `gh run list --workflow release-desktop.yml --limit 5`; `gh repo view allternit/desktop`; `ls surfaces/allternit-desktop/resources/bin`.

### B6. gizzi-code's only live distribution channel ships a broken package
npm tarball for `@allternit/gizzi-code@1.0.1` has `"files": ["src","bin"]` (~100KB, no `dist/`), but `bin` maps `gizzi` → `./dist/gizzi-code` (`cmd/gizzi-code/package.json:46-49`). `npm install -g` creates a dangling symlink; the hosted installer prints "installed successfully" but the first `gizzi` run fails (ENOENT). Also: `gizzi update` is dead — `MACRO.PACKAGE_URL` is never injected at build (`script/build-production.js:317-321` injects only VERSION/BUILD_TIME) and the GCS fallback bucket returns NoSuchBucket.
**Verify:** `npm view @allternit/gizzi-code@1.0.1 files bin dist.tarball` then download and inspect — no `dist/` directory.

### B7. Both deploy pipelines for the web + cloud API are currently RED on main
- `deploy-cloud-api-contabo.yml`: **5 consecutive failures**. Root cause: `Cargo.toml:208` path dependency `allternitos-cloud-contracts = { path = "../../AllternitOS/fabric/os/cloud-contracts" }` escapes the repo; CI can't load the manifest. Prod is current only because of manual deploy script runs.
- `deploy-cloudflare-pages.yml`: **last 2 runs failed** (`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` — `pnpm-workspace.yaml:70-86` overrides changed without regenerating `pnpm-lock.yaml`). Live web surfaces are stale since the Sep 2 15:10 build; no front-end fix can ship until this is fixed.
**Verify:** `gh run list --workflow deploy-cloud-api-contabo.yml --limit 6`; `gh run list --workflow deploy-cloudflare-pages.yml --limit 3`.

---

## Area 1 — Web Surface (`surfaces/ai.allternit.com`) — Grade D+

### Frame correction
The surface is a **Vite 8 SPA** (React 18 + React Router 7) statically exported to `dist/` and deployed to Cloudflare Pages by CI — **not Next.js** as `DEPLOYMENT.md`, `ARCHITECTURE.md`, and root `AGENTS.md:390` claim. Evidence: `package.json:19` (`"build": "vite build"`), `src/main.tsx:3`, `.github/workflows/deploy-cloudflare-pages.yml:70`. `next.config.mjs` and the surface's `wrangler.toml` are vestigial.

### What works
- CI builds and deploys on push to main; `dist/` is gitignored (not a checked-artifact problem).
- Clerk auth via `PlatformAuthProvider` (`src/main.tsx:52`, `src/lib/platform-auth-client.tsx`) — fail-closed: no key + no bypass → signed out (`:452`); dev mock bypass guarded by `import.meta.env.DEV` (`:411`).
- Route gating via `AuthGate` (`src/shell/ShellApp.tsx:966`) with allowlist-validated redirect targets (`src/pages/SignInPage.tsx:14-24`).
- `_redirects` correctly passes static assets; `sw.js` deliberately skips `/api/`, `/__clerk/`.
- `.env.production` committed with only publishable keys (`pk_live` Clerk, gateway URL) — no `sk_live` in the bundle.
- No hardcoded API keys in `src/` (only test fixtures/skill markdown).

### Gaps
- **Design connector API routes don't exist in prod.** `src/lib/design/direct-connectors.ts:52,75,96,117` POSTs to `/api/design/connectors/{github,linear,notion,slack}` — no `functions/` dir, no `/api/*` `_redirects` rule → HTML 200 responses. Orbit/connectors break silently. The design skill-discovery and dispatch-handoff endpoints are Vite dev-middleware only (`vite.config.ts:23-28` carries the comment "Production builds must replace this with a real backend implementation").
- **Debug/test pages shipped as production routes, several unauthenticated:** `/debug-mode` (writes `hasCompletedOnboarding` to localStorage to skip the wizard — `src/pages/DebugModePage.tsx:13`), `/gallery-test`, `/terminal-test`, `/terminal/clerk`, `/swarm-preview`, `/settings-preview`, `/markdown-preview` (`src/routes.tsx:144-148,156,112`).
- **Fake data in shipped views:** `HANDOFF.md:118` — `PerformanceAnalyticsView.tsx` has fake trends; Kanban placeholder tasks (`src/views/swarm/views/KanbanView.tsx:92,101`).
- **Runtime localhost fallbacks:** `src/integration/api-client.ts:33` and `src/lib/agents/api-config.ts:9` default to `http://127.0.0.1:8013` if env missing (saved only by committed `.env.production`); `src/views/aci/AciAddinView.tsx:168` hardcodes `http://127.0.0.1:8013/...` directly.
- **Dead fallback host:** `src/lib/hosted-compute.ts:58`, `src/pages/RuntimePairingPage.tsx:32` default to `https://allternit-cloud-api.fly.dev` (dead — curl times out; 20s+ hangs).
- **Wrong/stale wrangler.toml:** `wrangler.toml:2` `pages_build_output_dir = "out"` (Vite emits `dist/`), project name `allternit-platform`, `NEXT_PUBLIC_APP_URL = "https://platform.allternit.com"` on the **ai** surface. CI bypasses it, but a plain `wrangler pages deploy` would push the AI site onto the platform project.
- **`.env.production` duplicate conflicting keys:** Clerk URLs set twice (absolute platform/remotecontrol hosts, then overridden to relative). Last-write-wins makes the file ambiguous.
- **No security headers:** `public/_headers:1-6` has no CSP, no frame-ancestors, no HSTS, no Referrer-Policy — for an app handling OAuth redirects and Clerk sessions. `/discovery-feed.json` serves `Access-Control-Allow-Origin: *`.
- **No observability:** no Sentry/analytics deps; no app-level ErrorBoundary in `main.tsx` (per-view ones only); `index.html` `window.onerror` just console.errors.
- **No quality gate in deploy workflow:** builds then deploys with no test/typecheck/lint. Playwright suite exists (`tests/`, `clerk-e2e.spec.ts`, `desktop-cloud.spec.ts`) but nothing invokes it. Typecheck has known errors (`HANDOFF.md:10`).
- **Env validation can't fail the build:** `main.tsx:14-20` logs only.
- **Debug scaffolding committed at surface root:** `capture-*.mjs`, `vite.config.scratch-verify.ts`, `parse_doctor.py`, `verify_stream.ts`, `react-doctor-full.txt`.
- **TODO density:** 155 TODO/FIXME/HACK across 23 files; 242 `localhost` occurrences across 108 files.
- **Leftover auth-bypass surface:** `src/components/dispatch/useRuntimes.ts:90` accepts `token === 'dev-token'` when `ALLTERNIT_LOCAL_DEV_BYPASS === 'true'` (unreachable in prod today — non-`VITE_` key never reaches the browser bundle — but fragile).
- **Static bearer in bundle when set:** `VITE_ALLTERNIT_SELF_HOSTED_TOKEN` compiled into public JS and sent as a header (`api-client.ts:35,432,562`).

---

## Area 2 — Backend: allternit-cloud-api (api.allternit.com) — Grade C+

### What works (verified live)
- `GET /api/v1/health/live` → `{"alive":true}`, `/api/v1/health/ready` includes DB check; `/api/v1/metrics` Prometheus-format.
- Clerk session JWT verification via JWKS from `allternit.com/__clerk/.well-known/jwks.json` (200 live).
- Stripe + Clerk webhooks HMAC-verified, fail-closed when secrets unset (`billing_webhooks.rs:119-128`, `clerk_webhooks.rs:57-70`).
- Scoped `alt_` API tokens, sha256-hashed (`services/api_keys.rs:61-65`); scope enforcement in `auth/resolve.rs:43-50`.
- Free-tier guardrails shipped today: $2/mo allowance, 30 rpm free limiter, chargeback hold, per-provider pool budgets with 80%/100% circuit, daily `infra/cloud/reconcile_billing.py` + systemd timer + Alertmanager.
- Hosted runtimes provision as Docker containers with metered usage and disk-quota reconciler (`services/contabo_runtime_service.rs`).
- Deploy script with post-swap health check + auto-rollback (`deploy-contabo.sh:50-71`).

### Gaps
- **B1 backdoor** (see Verified Blockers) + **MD5 token hashing** at `auth/middleware.rs:269` ("in production, use proper hashing" comment in code) for legacy `allternit_*` tokens.
- **Dev-mode kill switch:** `Allternit_API_DEVELOPMENT_MODE` (mixed-case name) fully disables auth (`middleware.rs:209-217`) and enables permissive CORS (`lib.rs:390-395`).
- **No migration runner:** `cloud-api/src/lib.rs:502-503` TODO; `cmd/allternit-cloud-api/migrations_pg/001…010` applied by hand over ssh per `docs/Operations/CLOUD_API_VPS_DEPLOY.md:13-14`. A stale-binary incident happened today (three deploys shipped an old binary, documented `CLOUD_API_VPS_DEPLOY.md:16`).
- **WebSocket run channel** `/ws/runs/:id` accepts only API tokens/dev-token — **no Clerk JWT path** (`websocket/run_ws.rs:17`) — so browser clients holding Clerk sessions can't connect, and the channel can approve tools / pause / resume / cancel runs.
- **Internal billing endpoints public:** `/api/v1/internal/billing/*` (`hosted_entitlements.rs:76-83`) behind only the 30 rpm limiter; protection is a single env secret (well-implemented constant-time compare, but a public brute-force surface).
- **Hardening stubs unwired:** `fabric/hardening.rs` — `OrganizationLimit::disabled`, `ProviderHealth` placeholder, `OrphanCleanupJob` only `describe()`s. No org spend caps, no provider circuit breaker, no orphan cleanup.
- **Free-allowance anti-abuse is per-user-id only** — Clerk JWT carries no email-verification flag; sock-puppeting the $2 allowance is trivial.
- **Two divergent model surfaces:** cloud-api model router (real proxy + metering) vs allternit-api fabric `/v1/responses` (canned stub that **charges credits for fake responses**). If the fabric surface is ever exposed, customers get charged for canned output.
- Rate limit 60 rpm default (`main.rs:95`) — tight for a multi-user SPA.

---

## Area 3 — Backend: allternit-api (port 8013, desktop-cloud) — Grade C

### What works
- Comprehensive migration set (V1–V123) auto-applied via refinery (`src/db.rs:7-20`).
- Localhost auth bypass gated behind `local_dev_bypass()/self_hosted()` + loopback origin checks (`src/auth.rs:892-918`).
- Rails peer routes, MCP routes, office/cowork route families — full-featured for its local/desktop role.

### Gaps
- **CORS mirrors any origin with credentials** (`src/main.rs:843-846` — `AllowOrigin::mirror_request()` + `allow_credentials(true)`, described as "for local dev" but not env-gated).
- **Spoofable-origin auth bypass in the shipped prod env template:** `infra/vps-desktop-cloud/api.env.template:6` sets `ALLTERNIT_LOCAL_DEV_BYPASS=true`; `auth.rs:141-163` treats `Origin`/`Referer` containing "localhost" as proof of locality (trivially spoofed), and `auth.rs:898-912` then authenticates as the default local user. `ALLTERNIT_SELF_HOSTED=true` (template line 5) triggers the same path. Template describes a **multi-tenant** deployment (line 48) while the service is publicly reachable.
- **Unreachable from the web surface** (see B3) — fine for loopback/desktop use, fatal for web integration.
- Hardcoded tailnet IPs/hostnames (`api.env.template:37`, `deploy-contabo.sh:21`).
- Service runs as `User=root`/`Group=root` (`infra/vps-desktop-cloud/allternit-api.service`); the privilege-dropping `entrypoint.sh` is not referenced by the unit.

---

## Area 4 — Distribution & Packaging (`../distribution`) — Grade D

- All build scripts dead: reference `7-apps/` (gone), relative paths without `$HOME`, `build.sh:2` still says "OpenClaw". No `dist/` ever produced.
- Homebrew formula stub: `distribution/backend/homebrew/allternit-backend.rb:8-17` has `sha256 "PLACEHOLDER…"` ×4 targeting nonexistent `allternit/backend` releases.
- Documented pipeline script `scripts/build-desktop.sh` referenced by workflow comments and `verify-packaged-resources.cjs:35,73` — **does not exist** in `surfaces/allternit-desktop/scripts/`.
- `curl|bash` installer (`distribution/backend/deploy/install.sh`) with no signature verification of downloaded tarballs.
- Desktop `npm install` non-reproducible: no lockfile in `surfaces/allternit-desktop`; CI runs bare `npm install` with caret ranges (`"electron": "^41.10.3"`).
- `download-lima.cjs:33` hardcodes a Darwin tarball — configured Linux/Windows targets can't stage limactl.
- Stale `.bak` files in `distribution/unified/desktop-integration/`.

---

## Area 5 — Desktop App (`surfaces/allternit-desktop`) — Grade F

### What works
- **Unit tests 94/94 pass** (vitest, 11 files) — mini-app sandbox, secrets, OAuth broker, policy proxy, office managers are genuinely well-tested.
- Security primitives: tokens held in main process only, `safeStorage` encryption for session + OAuth tokens (`auth-manager.ts:1214`), custom `allternit-api://` / `allternit-gizzi://` protocol brokers that inject auth without exposing credentials to the renderer (`unified-main.ts:1792,1869`), contextIsolation on, nodeIntegration off, sandbox on for most windows, hardened webview guests (`:654`).
- Connectivity fallback: unreachable remote → local static UI served by Rust API at `127.0.0.1:8013` (`unified-main.ts:894-927`) with 5s reachability timeout.
- Graceful auto-update failure (logs + broadcasts error state, no crash loop, `unified-main.ts:151-183`).
- Single-instance lock, bounds persistence, tray with live backend status, watchdog, clean teardown.
- No telemetry (README claim verified); electron-log local only.

### Gaps
- **B4 compile/startup failure** (Verified Blockers) — bad merge today.
- **No IPC sender validation anywhere:** no `event.senderFrame`/origin checks on ~120 handlers. Any renderer frame holding the preload — including the remote `https://platform.allternit.com` content the main window loads — gets full access: `shell:open-external` with arbitrary URL, no scheme allowlist (`unified-main.ts:2118` → preload `index.ts:309`), gizzi-daemon install/uninstall, tunnel token exposure (`tunnel:start` returns the token, `:3165`), backend restart, mini-app secrets. **Any XSS in the platform web surface = full desktop compromise.**
- **No `will-navigate` guard** on mainWindow — only `setWindowOpenHandler` (`:589`). Remote content can navigate anywhere while keeping the preload.
- Mini-window runs `sandbox: false` (`:1388`) while every other window is sandboxed.
- CORS `Access-Control-Allow-Origin: *` on both privileged custom protocols (`:1801,1850,1876`) with credential injection in main.
- Backend env passes the entire Electron `process.env` into the spawned Rust API (`backend-manager.ts:119`).
- Backend crash-respawn loop with no backoff: 1s respawn forever if the binary is missing (`backend-manager.ts:161-170`); watchdog re-fires every 30s.
- `initializeDevelopmentMode` creates two main windows (`:1189,1205`) — first leaks; DevTools force-opened.
- Renderer loads remote `https://ai.allternit.com` — contradicts release-notes claim "no internet required after install".
- Docs are fiction: BUILD.md describes a Next.js `../allternit-platform` server that doesn't exist; README.md describes a thin client for a self-hosted backend at `localhost:4096` with brew tap `allternit/desktop`, winget, MIT license (package.json says UNLICENSED). AUDIT.md (2026-07-03) claims "builds cleanly" — currently false.
- No crash reporting → zero field-failure visibility.

---

## Area 6 — Allternit Cloud Product & Integration — Grade D

### What the product is
api.allternit.com = cloud-api on Contabo VPS "mail" (45.84.138.187), nginx + Let's Encrypt, Cloudflare Full(strict), PG 16 primary + hot-standby replica, failover runbook tested 2026-09-02 (`docs/Operations/FAILOVER_RUNBOOK.md`). Paid surface is **platform.allternit.com** (same Vite/Pages stack); ai.allternit.com calls the cloud API on dispatch/hosted-compute paths.

- **Billed:** inference per-token retail (model_router + `inference_settlement.rs`), hosted runtime hours, credit packs `$10/25/50/100` (hardcoded `billing_checkout.rs:43-48`), subscriptions Plus $20 / Super $100 / Ultra $200 (hardcoded `billing_subscriptions.rs:60-62`).
- **Free:** $2/calendar-month inference allowance, 30 rpm free limiter, BYOK at $0, `/v1/models`, pairing tier quotas.
- Three product lanes all self-report **Partial** (`cmd/allternit-api/src/fabric/product_lanes.rs:42-78,100-118,144-176`): managed inference (real in cloud-api; fabric stub in allternit-api), managed harness (gizzi VM path only, no OpenCode), cloud computer use (substrates only — no capability surfaces at all).

### What works
- Model gateway: provider proxying to OpenRouter/Together/Fireworks/Groq/DeepInfra, streaming, retail+wholesale metering, pre-dispatch balance check, pool budget breaker, BYOK path. Smoke-tested live per `.steering/checkpoint.md` (12/12 soak).
- Billing stack: Stripe checkout/portal/subscriptions, HMAC webhooks, chargeback hold, idempotent entitlement sync; success URLs default to `platform.allternit.com/billing`.
- Scoped API tokens (8/8 live scope checks).
- Cowork runs executor with CAS claim dispatching to registered gizzi instances (`executor_service.rs`).

### Integration matrix

| Integration | State |
|---|---|
| platform console → cloud-api (Clerk session, billing/models/keys/BYOK) | **Working** |
| ai.allternit.com chat → gateway via api-client | Working but fragile: source default is `http://127.0.0.1:8013` (`api-client.ts:33`); CI doesn't pass the env var for this job — a build without `.env.production` ships a localhost gateway |
| Cowork runs UI on web (`src/lib/cowork/useCoworkRuns.ts:62-112`) | **Broken three ways**: relative `/api/v1/runs` → Pages catch-all returns HTML; route requires legacy Bearer while SPA sends Clerk sessions; calls `POST /api/v1/runs/:id/recover` which **does not exist** (`cloud-api/src/lib.rs:81-109`) |
| gizzi-code self-registration / mesh (`flag.ts:71`, `mesh.ts:54`) | **Broken by default**: defaults to dead `https://allternit-cloud-api.fly.dev` / `allternit-headscale.fly.dev`; no docs tell npm users to set env vars |
| iOS mobile app | Works **only because of the dev-api-token backdoor** (token hardcoded) |
| SettingsDrilldown "API Console" (`SettingsDrilldown.tsx:202`) | Opens dead fly.dev URL |
| allternit-api fabric `/v1/responses` | Canned stub that charges credits for fake responses |
| `devices` API scope | Offered in platform UI (`ApiKeysPage.tsx:25-30`) but backend never checks it; a default `read`-scoped key gets 403 on billing reads |

### Other gaps
- **B7 deploy pipelines red** (Verified Blockers). Contabo workflow fails on the `../../AllternitOS` path dep; Pages workflow fails on lockfile mismatch.
- Owner actions pending (`.steering/checkpoint.md:172-176`): Tailscale `tag:ci` auth key + `gh secret set TS_AUTHKEY` never done; no real $10 Stripe purchase executed end-to-end; DeepInfra/OpenRouter keys unfunded; Fireworks reasoning aliases return empty content.
- Hosted workloads share one box with the Postgres primary (single `local` docker node, `contabo_runtime_service.rs:176`).
- Donor handoff (`ALLTERNIT_CLOUD_DONOR_HANDOFF.md`) promised honest views/compile-ready stubs/status reporting — delivered exactly that. Its self-declared gaps remain open. Note: two divergent model gateway surfaces now exist (one real, one charging stub).
- Docs still call the platform Next.js; `PRODUCTION_READINESS_TRACKER.md` references legacy `7-apps/` paths.

---

## Area 7 — gizzi-code (`cmd/gizzi-code`) — Grade D+

### What works
- Builds and boots: `bun run build` → working binary, `dist/gizzi-code` rebuilt today, `--version` → 1.0.1 (verified on the binary).
- Real release infra: `.github/workflows/release-gizzi-code.yml` (5 successful runs, Jul 27–28); npm publish workflow shipped `@allternit/gizzi-code@1.0.1`.
- Harness integration exists (`src/utils/feature-flags.ts:7-41`, `harness.ts`, `REPL.tsx`) — stale docs claim otherwise.
- Rails peer real in shipped bundle (registers, 2s inbox poll, 30s heartbeat; `GIZZI_ENABLE_RAILS_PEER=0` opt-out verified in bundle).
- Worktree support mature: path-traversal-hardened slugs (`src/shared/utils/worktree.ts:66-87`), sparse-checkout with teardown.
- Hosted-runtime provisioning chain consistent: cloud-api pins `hosted-runtime-2026.07.16` + sha256; release asset verified to exist with matching digest.
- install.gizziio.com live (200); secure storage via macOS Keychain; skills system with remote discovery.
- OAuth PKCE properly implemented (localhost redirect, refresh, allowlist).

### Gaps
- **B6 broken npm package + dead updater** (Verified Blockers).
- Repo install script 404s: `cmd/gizzi-code/install:184-194` fetches `…/latest/download/gizzi-code-darwin-arm64.tar.gz`; real assets are `gizzi-code-v0.2.3-…tar.gz` (both URL forms verified 404).
- **Version skew everywhere:** npm/package.json 1.0.1 vs latest GitHub release **0.2.3** vs cloud runtime pin **2026.07.16** (7-week-old binary provisioned to production VPSes) vs local dist from Jul 26.
- **Tests are a sham:** `package.json:27` — `"test": "echo '…skipped…' && exit 0"`. 148 test files exist; CI (`cmd/gizzi-code/.github/workflows/test.yml`) runs `bun turbo test` → resolves to the echo. Nothing gates the build.
- **Type safety cosmetic:** 3,698 of 5,755 source files carry `@ts-nocheck` (incl. `railsPeer.ts:1`, `autoUpdater.ts:1`). `PRODUCTION_QUALITY_AUDIT.md` claims "0 TypeScript errors" — only because checking is disabled.
- **Stub landmine:** `src/runtime/gizzi-core/services/mcp/channelAllowlist.ts` is `export {}` while `channelNotification.ts:36-40` imports functions from it — any reachable import throws TypeError (currently tree-shaken out).
- **Hardcoded/dev-only:** fallback token `'gizzi-local-token'` sent as `x-allternit-desktop-access-token` on every API call when unconfigured (`src/runtime/services/api/allternitApi.ts:86`, `railsPeer.ts:190`); dev headers behind typo'd env `Allternit_DEV_MODE` (`src/cli/commands/org.ts:57-62`); OAuth CLIENT_ID hardcoded (`src/constants/oauth.ts:169`); dead fly.dev default (`flag.ts:71`).
- **Plaintext credential storage on Linux/Windows** — secure storage falls back to readable file off-macOS (`src/shared/utils/secureStorage/index.ts:11-18`, "// TODO: add libsecret").
- **No fetch timeouts** in `apiFetch`/railsPeer — a hung backend piles up 2s-interval pollers; errors swallowed into logs.
- **Default platform API is localhost:** `allternitApi.ts:18` defaults to `http://127.0.0.1:8013`; tasks/canvas/rails/cron tools silently no-op in production unless `ALLTERNIT_API_URL` set. No env validation.
- **Un-rebranded fork residue** (Claude Code/amp lineage): `.claude/worktrees` paths, "A claude server is already running", `claude update` in error message, `@anthropic-ai/gizzi`, synthetic `sk-ant-cc-` token minting (`main-gizzi.tsx:4037`).
- Phantom dep: `chalk` imported by ≥5 files, not in package.json (works via hoisting only).
- `.github/workflows/gizzi.yml` runs gizzi on PR/issue comments (`/gizzi` trigger) with repo secrets-adjacent token — prompt-injection surface.
- Conflicting release workflows: `cmd/gizzi-code/.github/workflows/release.yml` (inert, wrong npm name `@gizzi/gizzi-code`) vs the live root one.
- OAuth console login depends on cloud-api implementing an Anthropic-compatible OAuth server accepting the hardcoded client ID — **unverified**; if it 404s, login is the first thing users hit.
- Docs swamp: 40+ status markdowns, several provably stale (claim release workflow missing / harness not integrated — both done).

---

## Area 8 — Cloud & Infrastructure (VPS, Cloudflare, DNS, observability) — Grade C

### What works
- api.allternit.com topology documented and cross-checked: Contabo "mail" + nginx + Let's Encrypt, Cloudflare proxied, Full(strict). Hot-standby PG replica; failover tested 2026-09-02.
- Monitoring stack on mail: Prometheus :9091, Grafana :3000, Alertmanager :9093.
- Headscale control plane on Fly.io with genuine per-customer isolation: `autogroup:self` default-deny ACLs, no exit nodes (`infra/mesh/headscale/config.yaml:59-61`).
- Desktop-cloud VPS deploy script with timestamped backups, env merge preserving secrets, rollback (`infra/vps-desktop-cloud/deploy.sh:42-92`).
- Secrets pattern sound: `.env*` gitignored, GitHub Secrets for CI, chmod 600 on server env, AES-GCM for BYOK keys.
- Cloud-handoff docs (`ALLTERNIT_CLOUD_DONOR_HANDOFF.md` / `..._COMPLETE.md`) honest and accurate against code.

### Gaps
- **No automated off-host backup of production Postgres** (credits ledger + all user data). Only the hot-standby replica (replicates deletions) and a one-off pg_dump in a migration doc. Headscale sqlite is a single Fly volume with no backup job. No restore drill.
- **No Prometheus/Alertmanager/Grafana config exists in the repo** — the entire observability stack is untracked manual state on the VPS. Rebuilding mail loses alerting silently.
- **No uptime monitoring, status page, paging, or backup-restore drill.** `infra/vps-desktop-cloud/PRODUCTION_HARDENING.md` is 100% unchecked (unattended upgrades, SSH key-only, firewall, Stripe live reconciliation).
- `TS_AUTHKEY` GitHub secret never set — next cloud-api push fails CI (`.steering/checkpoint.md:172-176`).
- Backup template ships default MinIO creds `minioadmin/minioadmin` (`infra/vps-desktop-cloud/backup.env.template:4-5`).
- `bootstrap-host.sh:69` opens Incus API 8443 to the internet (`ufw allow 8443/tcp`) contradicting the hardening checklist's "Tailscale traffic only".
- clerk-proxy reflects any Origin with credentials (`infra/clerk-proxy/index.js:99-100`); no CI workflow deploys clerk-proxy — its live state is unverifiable from the repo. Cloudflare zone ID committed (`infra/clerk-proxy/wrangler.toml:6-9`).
- Failover runbook uses a Cloudflare **global API key** (`FAILOVER_RUNBOOK.md:22-27`) — rotation undocumented.
- Dual deploy paths: `deploy-cloud-api-railway.yml` + root `railway.json` fire on overlapping paths with no test gate; Dockerfile defaults to `DATABASE_URL=sqlite:///data/api.db` for a Postgres-only codebase.
- Stale `docs/Operations/CLOUDFLARE_MAPPING.md` (April 2026, wrong project names) and `HANDOFF_CLOUDFLARE_DEPLOYMENT.md` ("INCOMPLETE") contradict working CI.
- Desktop-instance backups only while instances run, only to local MinIO with template default creds.

---

## Consolidated Action Plan

### P0 — Before launch (tonight)

| # | Action | Evidence anchor |
|---|--------|-----------------|
| 1 | Delete the `dev-api-token` fallback in both middleware paths; redeploy cloud-api; rotate minted tokens; fix the iOS app's hardcoded token | `cloud-api/src/auth/middleware.rs:313-316,106-108`; `APIClient.swift:124` |
| 2 | Rotate the Clerk test-account password; scrub `TESTING.md` | `surfaces/ai.allternit.com/TESTING.md:6` |
| 3 | Decide the API story: nginx-route 8013 paths on api.allternit.com **or** repoint the gateway **or** feature-flag broken features off — then smoke-test every authenticated feature | `api-client.ts:33`; verified 404s |
| 4 | Set `gh secret set TS_AUTHKEY` (Tailscale `tag:ci` key) | `.steering/checkpoint.md:172` |
| 5 | Fix `pnpm-lock.yaml` (overrides mismatch) so `deploy-cloudflare-pages.yml` is green again — nothing can ship until then | `pnpm-workspace.yaml:70-86` |
| 6 | Fix cloud-api CI path dep: vendor `allternitos-cloud-contracts` or convert to git dep | root `Cargo.toml:208` |
| 7 | Disable/feature-flag Orbit design connectors (POSTs return HTML 200) | `direct-connectors.ts:52-117` |
| 8 | Repoint gizzi-code + surface defaults from dead fly.dev to `https://api.allternit.com` / `headscale.allternit.com` | `flag.ts:71`, `mesh.ts:54`, `hosted-compute.ts:58`, `SettingsDrilldown.tsx:202` |
| 9 | Revert or repair today's bad desktop merge (`ea89a5fdb`) so `main` typechecks | `unified-main.ts:210-232,1436-1523,2182-2287,2311-2874` |

### P1 — Launch day

| # | Action | Evidence anchor |
|---|--------|-----------------|
| 10 | Fix or delete `surfaces/ai.allternit.com/wrangler.toml` (wrong project + `out/` dir) | `wrangler.toml:2,6` |
| 11 | Remove/gate public debug & test routes (`/debug-mode` etc.) | `src/routes.tsx:144-156` |
| 12 | Add app-level ErrorBoundary + client error reporting (Sentry or equivalent) | `src/main.tsx` |
| 13 | Add test/typecheck gate to the Pages deploy workflow | `deploy-cloudflare-pages.yml` |
| 14 | Set `ALLTERNIT_LOCAL_DEV_BYPASS=false` in any prod env using the desktop-cloud template | `api.env.template:6`; `allternit-api/src/auth.rs:141-163` |
| 15 | Deduplicate `.env.production` conflicting Clerk keys | `surfaces/ai.allternit.com/.env.production` |
| 16 | Decide desktop scope: **launch web-only**, announce desktop as coming soon | entire Area 4/5 |
| 17 | Fix cowork-runs web path: route through cloud API base with working auth, or remove the feature | `useCoworkRuns.ts:62-112` |
| 18 | Security headers on Pages (`_headers`): CSP, frame-ancestors, HSTS, Referrer-Policy | `public/_headers:1-6` |

### P2 — First week (do not skip)

| # | Action | Evidence anchor |
|---|--------|-----------------|
| 19 | Nightly `pg_dump`/wal-g off-host + restore drill; snapshot Headscale volume | Area 8 |
| 20 | Wire `sqlx::migrate!` into `init_db()` against `migrations_pg/` | `cloud-api/src/lib.rs:503` |
| 21 | Commit Prometheus/Alertmanager/Grafana configs to the repo | Area 8 (untracked manual state) |
| 22 | Desktop distribution as its own project: fix release workflow, create `allternit/desktop` + `allternit/backend` repos, enable signing (CSC_LINK/CSC_NAME) + notarization, populate all 5 manifest checksums, restore resource staging | Area 4/5 |
| 23 | Fix gizzi-code npm packaging (include binary or launcher shim; publish-time bin-exists check); inject `MACRO.PACKAGE_URL`; cut GitHub release v1.0.1; re-pin cloud runtime asset + sha | Area 7 / B6 |
| 24 | Desktop IPC hardening: sender-frame origin checks, `will-navigate` allowlist, `open-external` scheme allowlist | `unified-main.ts` (~120 handlers) |
| 25 | MD5 → sha256 migration for legacy `api_tokens` | `middleware.rs:269` |
| 26 | Add Clerk JWT path to the run WebSocket so browser clients can connect | `websocket/run_ws.rs:17` |
| 27 | Free-allowance anti-abuse: require email verification before allowance | checkpoint open question |
| 28 | Desktop backend respawn backoff | `backend-manager.ts:161-170` |
| 29 | gizzi-code: real test gate in CI (148 test files exist), strip `@ts-nocheck` from runtime paths, fix phantom `chalk` dep, require `ALLTERNIT_API_URL` in production mode | Area 7 |
| 30 | Docs correction pass: DEPLOYMENT.md, ARCHITECTURE.md, root AGENTS.md (all say Next.js), BUILD.md, desktop README, CLOUDFLARE_MAPPING.md | Areas 1/4/5/6 |

---

## How to Corroborate This Report

A second agent should independently verify, at minimum:

1. `curl -s -H "Authorization: Bearer dev-api-token" https://api.allternit.com/api/v1/auth/me` — expect 200 + wildcard permissions (if fixed by then, expect 401 — note the fix date).
2. Read `surfaces/ai.allternit.com/TESTING.md:6` — password presence (or its removal).
3. `curl -s -o /dev/null -w '%{http_code}' https://api.allternit.com/api/jobs` — expect 404 (or 200/401/403 if the routing story was fixed).
4. `cd surfaces/allternit-desktop && npx tsc --noEmit -p src/main/tsconfig.json` — error count (expect 9 at audit time).
5. `gh run list --workflow release-desktop.yml`, `gh run list --workflow deploy-cloud-api-contabo.yml`, `gh run list --workflow deploy-cloudflare-pages.yml --limit 3` — confirm the red/green claims.
6. `gh repo view allternit/desktop` — expect 404.
7. `npm view @allternit/gizzi-code@1.0.1` + tarball inspection — confirm no `dist/`.
8. `git log --oneline -3 main` and `git status` — confirm repo state vs `88baa91ab`.
9. Spot-check 10 random file:line citations above by reading the files directly.
10. `ls surfaces/allternit-desktop/resources/bin` — confirm absence (or restoration).

*Report produced by deep-readonly audit; no code was modified. All live probes were read-only (GETs and health checks).*


---

# Addendum — Cross-Agent Corroboration (2026-09-03, later same day)

Five independent audit agents returned reports covering overlapping scope. This addendum reconciles them with the main report: what is now confirmed by 2+ independent agents, where reports conflict, and net-new findings that raise (or nuance) severity.

## Sources

| ID | Agent | Scope | Grade given |
|----|-------|-------|-------------|
| A1 | session_e9b50884 (ledger convention) | Web + desktop, repo-wide | 14-area table |
| A2 | session_d2315f8d | This report (8 areas) | D+ overall |
| A3 | session_da7b70f4 | Desktop only | D+ ("not releasable as-is; shippable in 1–2 days with scope cut") |
| A4 | session_237dc49a | gizzi-code only | Plan-mode, 6 phases, ~4–6 weeks |
| A5 | session_423a858e | Allternit **Websites** repo (15 marketing surfaces, live) | not graded |

## Confirmed by 2+ independent agents (treat as established fact)

1. **`dev-api-token` backdoor** — live-verified by this report (B1); A4 independently found the same fallback in `cmd/allternit-cloud-api/src/auth/resolve.rs:239-245`. Two independent code paths, one finding.
2. **Committed credentials are a pattern, not one mistake** — this report: production Clerk password in `TESTING.md:6`. A1 additionally found a **committed ProtonMail password + TOTP seed**. A4 found a **committed Clerk `sk_test` key** at `cmd/gizzi-code/script/platform-auth-server.js:19-21`. → Action item P0#2 must expand to a full secrets sweep + rotation + gitleaks in CI, not just TESTING.md.
3. **Desktop merge damage at HEAD (`ea89a5fdb`)** — all three desktop-touching audits agree on `unified-main.ts` duplicates and startup crash. Error count: this report and A3 counted **9**; A1 counted **11** (9 in unified-main.ts + 2 duplicate preload keys at `src/preload/index.ts:399`). A1's 11 is likely correct — its scope included the preload tsconfig; verify with `npx tsc --noEmit -p src/preload/tsconfig.json`.
4. **`allternit/desktop` etc. repos don't exist** — verified by A2 (gh), A1, and A3 independently.
5. **Signing/notarization cannot succeed** — `identity: null`, no CSC secrets, silent-skip notarizer: A1, A2, A3 agree.
6. **No shippable artifact exists** — A2 (no release output), A1 ("hollow 608 MB non-app artifact"), A3 (B3: release/mac-arm64 has no executable/Info.plist/DMG) agree.
7. **Docs describe a product that doesn't exist** (Next.js/Vercel, thin-client README, BUILD.md fiction): A1, A2, A3 agree.
8. **gizzi-code distribution broken** — broken npm package (A2, verified by tarball inspection), dead `gizzi upgrade` (A4, three separate bugs), 404ing installer asset URLs (A2, A4), version skew 1.0.1/0.2.3/2026.07.16 (A2, A4).
9. **Dead `allternit-cloud-api.fly.dev` defaults** in clients (A2: web surface fallbacks; A4: gizzi-code `flag.ts:71` + headscale) — A4 calls this the cloud-linkage showstopper; one-line fix.
10. **No observability anywhere** — web surface (A2), desktop (A1, A3: no uncaughtException/render-process-gone handlers), all 15 marketing sites (A5: zero analytics).

## Conflicts between reports — must re-verify

| # | Conflict | Reports | Status |
|---|----------|---------|--------|
| C1 | **ai.allternit.com `_redirects` behavior.** This report (Area 1) claims "_redirects correctly passes static assets." A5 verified **live** that the catch-all swallows real static assets — local WebGPU models and the public benchmark leaderboard are broken on the live site *today*. | A2 vs A5 | **RESOLVED 2026-09-03 (A5 correct).** Live re-verified: `/benchmarks/index.html`, `/bonsai-webgpu-worker.js`, `/desktop-cloud-admin.html`, `/leaderboard`, `/models/`, `/favicon.ico` all return the 4202-byte SPA fallback (byte-identical to a guaranteed-404 URL); `/demos/` (15,441B real content) works because it *is* explicitly listed. `public/_redirects` itself documents the hazard. Fix: add pass-through rules for `/benchmarks/*`, `/bonsai-webgpu-worker.js`, `/desktop-cloud-admin.html`, `/desktop-cloud-admin.js`, `/plugin-manager-demo.html`, `/favicon.ico` (see Execution Guide step 8). |
| C2 | **install.gizziio.com works or not.** A5: "install.gizziio.com — all install paths verified working." A2: npm package has no `dist/` (dangling symlink); A4: install script tag-parsing broken, asset names 404. | A5 vs A2/A4 | Reconcilable: A5 likely verified the *script serves and runs* (the installer prints success because `command -v gizzi` passes on the dangling symlink). A2's tarball inspection is decisive: **the installed binary does not run.** Treat A2/A4 as correct; A5's "working" means "script executes," not "user gets a working gizzi." |
| C3 | **Desktop grade: F vs D+.** | A2 vs A3 | Semantics, not facts. A2 graded HEAD (doesn't compile → F). A3 graded with the nuance that a **stale Aug-30 `dist/` predates the bad merge**, so local runs still "work," security fundamentals are solid, and 94/94 unit tests pass → D+. **Both are right; the actionable statement both agree on: nothing fresh-buildable can ship from HEAD, and a real release is 1–2 days of work with scope cut, not hours.** |
| C4 | **Typecheck error count 9 vs 11.** | A2/A3 vs A1 | See confirmed item 3 — likely 11 total across main + preload tsconfigs. |

## Net-new findings from other agents (not in the main report body)

### From A1 (raise severity / add)
- **Committed ProtonMail password + TOTP seed** — expand P0#2 to a repo-wide secrets sweep.
- **Fake knip reports** committed at the web surface root (`knip-report*.json` generated to look like analysis) — hygiene/embarrassment.
- **Inaccurate ledger attestation**: the session that merged `ea89a5fdb` attested "typecheck clean" when it was not — the AGENTS.md ledger convention needs the attestation verified before merge, exactly the failure it was designed to catch.

### From A3 (desktop depth — several are worse than reported)
- **Startup/auth (Clerk) window runs `nodeIntegration: true, contextIsolation: false`** (`startup-window.ts:304-306`) — XSS in the sign-in window = main-process RCE. Worse than the sandbox inconsistency in Area 5.
- **Windows auto-update broken by design**: `update-electron-app` uses Squirrel; the target is NSIS — can never work on Windows. Plus `publisherName: "Allternit"` contradicts SIGNING.md, `verifyUpdateCodeSignature: false`.
- **All bundled native binaries are Mach-O arm64** (gizzi-code, voice service, allternit-mux, limactl, cua-driver, office-engine deps); `download-lima.cjs` packs a Darwin tarball into win/linux installers; `lima.ts` prefers the bundled Mach-O with no platform guard. **There is no Windows/Linux runtime story** — minimum viable: gate VM features behind darwin and ship macOS-first.
- **`allternit-voice-service` is a hard build requirement with no source** in the repo (`verify-packaged-resources.cjs:43-46`) — CI can never pass verification.
- **Electron 41 is EOL** (current stable 44; only last 3 majors get security fixes).
- Release workflow double-publish race (`release-desktop.yml:170,286,330`); no Linux CI job despite AppImage+deb targets; tray never initializes (missing icon); Bonsai companion hardcodes macOS paths on all platforms; stale `dist/` from Aug 30 masks the broken merge locally.

### From A4 (gizzi-code depth — the largest single addition)
- **`gizzi` can hang indefinitely**: no timeouts on subprocess probes (`subprocess.ts:538`), config fetches (`config.ts:87`), or SDK calls; `bun install` inside `Config.get()` (`config.ts:177`). First-run experience can hard-hang.
- **SSRF in web proxy** (`src/runtime/server/routes/web-proxy.ts`): follows redirects without re-validation, no private-range blocking.
- **86 `bun audit` vulnerabilities** (1 critical seroval, 30 high incl. direct-dep `@modelcontextprotocol/sdk` GHSA-345p-7cg4-v4c7).
- **`gizzi web --mdns` exposes an unauthenticated agent API on the LAN** (defaults mDNS hostname to 0.0.0.0, `network.ts:52-54`); only `gizzi serve` refuses to run without a password.
- **`gizzi org` calls routes that don't exist on either backend** (`GET /api/v1/me`, `POST /api/v1/me/organization`) with a localhost:3001 default and a dev-mode header bypass (`org.ts:59-64`).
- **Plaintext API keys in config TOML** (`auth-profiles.ts:29-42`); credential-store abstraction exists but unused.
- **`gizzi uninstall` leaks**: cron daemon keeps running on :3031, `~/.gizzi` survives.
- **465 hardcoded test skips** (incl. safety-critical permission tests); cron engine (7.8k LOC, executes shell/http jobs) has zero tests.
- **Structural debt**: ink-app is a 2,732-file divergent fork-in-place of the outer tree (MCP client duplicated at 88% identity); 17 dead top-level src dirs (~14.4k LOC); 171MB binary carrying ~80MB dead vendored Claude Code subtree.
- **First-run onboarding literally doesn't exist** (`--onboarding` is dead code) — installs won't become activations.
- **Plugin system phones Anthropic's marketplace** (404ing GCS path, auto-installs Anthropic's plugin catalog).
- A4's honest estimate: **~4–6 weeks with 2–3 workers** for gizzi-code GA; Phase 0 (stop-the-bleeding) is 2–4 days.

### From A5 (Allternit Websites repo — separate repo, but launch-critical)
- **labs.allternit.com serves the wrong app** (Husks robot sim, itself broken) — Pages domain-binding issue. Worst single finding in that repo.
- **3dfacility.allternit.com does not exist** (no DNS/Pages/CI) but www.allternit.com has an uncommitted hero CTA pointing at it.
- **platform.allternit.com: the next deploy will 404 every auth route** — workspace sync drops the prerendered HTML that `_redirects` points at.
- **Homebrew cask ships `PLACEHOLDER_INTEL_SHA256`** for a nonexistent Intel build; app self-reports not-notarized → Gatekeeper warning on every first launch.
- robots.txt/sitemap/404 missing on ~13 of 15 sites; dead domains in content (app.allternit.com ×16, games.allternit.com ×5); zero analytics.

## Corroborated bottom line

The five audits converge on the same story with no material contradictions in the blockers:

1. **Tonight (P0), unchanged but expanded**: kill the dev-token backdoor; full secrets sweep + rotation (TESTING.md password, ProtonMail+TOTP, sk_test Clerk key — three independent discoveries of the same pattern); fix the pnpm lockfile so anything can deploy; fix the cloud-api CI path dep; decide the web↔backend routing story; repoint dead fly.dev defaults; fix or feature-flag the live `_redirects` asset breakage (C1).
2. **Desktop**: not tomorrow. All three audits converge: fix the merge (11 errors), resolve the voice-service question, gate VM/native features to macOS, create the update repo, sign+notarize (certificates have lead time — start now). Realistic: macOS signed release in 1–2 days; Windows/Linux labeled early-access after gating work.
3. **gizzi-code**: not this week for GA. Phase 0 (2–4 days) makes it safe to ship; full plan is 4–6 weeks. The npm package and installers must be fixed before any public push.
4. **Marketing sites (separate repo)**: labs domain binding and the uncommitted www CTA are tonight-items if the launch announcement touches them.

**No audited area received a grade above C+ from any agent. Two agents independently gave the overall platform D+ or below. The launch recommendation stands: web-only tomorrow after P0, desktop and CLI follow on their own tracks.**

---

# Execution Guide — How ONE Agent Works This Report

This section turns the findings into a sequenced work order for a single agent (human or AI). It assumes one worker, no parallelism, and the goal: **web platform live and stable tomorrow; desktop on a credible 1–2 day track.** Estimated total: one long session for P0 (~6–10 hrs), then P1 in a second session.

## Rules of engagement (read first)

1. **Work in a session worktree, never the shared checkout.** Per repo `AGENTS.md`: create/reuse `<repo>-session-<id>` on branch `session/<id>` and `cd` into it. Linked worktrees pass all git guards automatically. Do NOT run `git commit/checkout/switch/merge/push/rebase` in the main checkout.
2. **Checkpoint discipline.** At every subtask boundary, update `.steering/checkpoint.md` (`Goal` / `Just did` / `Next` / `Open questions`). Commits and pushes go through the steering commit gate — expect to wait for approval; batch related changes so you don't stall.
3. **NEVER do these without the user in the loop:**
   - Rotating/revoking any credential (TESTING.md password, ProtonMail+TOTP, Clerk keys, `dev-api-token` removal from production auth). You may *prepare* the change (remove from repo, open the PR) — the actual rotation/revocation/deployment to production is the user's call.
   - Purchasing or provisioning signing certificates (Apple Developer ID, Windows EV/OV).
   - Creating public GitHub repos under the `allternit` org (`allternit/desktop` etc.) — ask first; org permissions matter.
   - Deploying to production (pushing the merge, enabling CI deploys, publishing releases).
4. **Verify before and after every change.** Before touching a finding, run its **Verify** command from the report body and paste the result into your checkpoint. If it doesn't reproduce, STOP and reconcile — the fix list below is timestamped to `main @ 88baa91ab` and someone may have fixed it already.
5. **Definition of done for each step:** its verify command now shows the *fixed* state, tests/typecheck pass, and the change is committed on your session branch. Mark steps done in the plan file as you go; do not batch.

## P0 — tonight, in this exact order

> Rationale for the order: each step unblocks verification of later ones. The merge repair gates all desktop work; the lockfix gates all deploys; secrets removal is independent and can slot anywhere.

- [ ] **Step 0 — Setup.** Create session worktree per rule 1. Run the verify commands for B1, B4, B7 and record current (broken) state in `.steering/checkpoint.md`. You will paste before/after evidence for each.
- [ ] **Step 1 — Repair merge `ea89a5fdb` (B4).** In `surfaces/allternit-desktop/src/main/unified-main.ts`: remove the duplicate state declarations (`hudWindow`/`remoteControlWindow` at :210-215 and :232), delete ONE of the duplicated `createHudWindow`/`toggleHudWindow` blocks (:1436/:1523 vs :2182/:2287 — keep the pair consistent with the IPC registrations at :2312-2335; note the two `toggleHudWindow`s disagree: one hides, one closes — pick "hide" to match the tray/minimize contract, and confirm no other caller depends on close), and declare or remove `effectiveMode` (:732 — trace how the pre-merge code computed the mode at that site; do not invent a default). In `src/preload/index.ts:399-400`: remove the duplicate object keys. Then: `npx tsc --noEmit -p src/main/tsconfig.json && npx tsc --noEmit -p src/preload/tsconfig.json` → 0 errors; `npm run build` → green; `npm run test` (vitest, 94 tests) → green. Also grep that no `ipcMain.handle` key is registered twice (`grep -n "ipcMain.handle('" src/main/unified-main.ts | sort | uniq -d` pattern via awk) — the duplicate registrations at :2312/2850 etc. throw at Electron load even after tsc passes. **Done when:** all three commands green + no duplicate IPC registrations.
- [ ] **Step 2 — Fix the pnpm lockfile (B7, part 2).** `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` blocks every web deploy. Run `pnpm install --lockfile-only` at repo root after confirming `pnpm-workspace.yaml:70-86` overrides are final; commit the regenerated `pnpm-lock.yaml`. Then `pnpm -r exec true` (or a dry `pnpm install --frozen-lockfile` in CI mode) proves reproducibility. **Done when:** `pnpm install --frozen-lockfile` exits 0 on a clean clone simulation.
- [ ] **Step 3 — Fix cloud-api CI path dependency (B7, part 1).** `Cargo.toml:208` references `../../AllternitOS/fabric/os/cloud-contracts` which escapes the repo, killing `deploy-cloud-api-contabo.yml` 5×. Decide (user question if ambiguous): vendor the crate into `domains/` or this repo, or publish it to a registry — then repoint the path dep. `cargo build -p allternit-cloud-api` locally. **Done when:** `cargo metadata` shows no path dep escaping the repo; CI dry-run of the workflow's build step would pass (you can run the same commands the workflow runs).
- [ ] **Step 4 — Secrets sweep (B2 + A1/A4 findings).** You PREPARE; user executes rotations. (a) Remove the password from `surfaces/ai.allternit.com/TESTING.md:6,38,48` (replace with env-var instructions). (b) Locate the committed ProtonMail password + TOTP seed (A1 found it; grep for `proton`/`totp`/`2fa` in tracked files, incl. docs/ and root *.md) and excise it. (c) Remove the Clerk `sk_test` key from `cmd/gizzi-code/script/platform-auth-server.js:19-21` (env var with no default). (d) Add a gitleaks workflow (`.github/workflows/secrets.yml`, gitleaks-action on PR + push to main) and run `gitleaks detect --source . --verbose` locally; commit the baseline exclusion ONLY for the files you just cleaned, and note that **history still contains the secrets — the user must rotate them and consider BFG/git-filter-repo**. **Done when:** gitleaks clean on HEAD; user sign-off on the rotation list (deliver a short list: what, where found, where used, what to rotate).
- [ ] **Step 5 — `dev-api-token` backdoor (B1).** In `cmd/allternit-cloud-api/src/auth/`: gate both `validate_token_against_db` (`middleware.rs:313-316`) and the legacy `AuthLayer` (`:106-108`) behind an explicit dev-only config flag (default off; env-gated in deployment). Also fix the iOS hardcodes (`surfaces/allternit-mobile/ios/Core/API/APIClient.swift:124`, `PtyClient.swift:88`) — replace the literal with a build-config value. `cargo test -p allternit-cloud-api`. **Flag to user:** production currently depends on this token (iOS app in the field); removal needs a coordinated deploy. **Done when:** token rejected by default in tests; user informed before merge.
- [ ] **Step 6 — Web↔backend routing decision (B3).** This is a DECISION step, not pure code. The web UI calls `/api/jobs`, `/api/v1/agent-sessions`, `/api/v1/office/*`, `/api/v1/beta/*`, `/api/rails/*` — all 404 on api.allternit.com. Options: (a) deploy `allternit-api` (8013) publicly behind Cloudflare and point `VITE_ALLTERNIT_GATEWAY_URL` at it for those routes; (b) mount those routes into cloud-api; (c) feature-flag the broken UI surfaces off for launch. Prepare the analysis with effort estimates, **ask the user to pick**, then implement the chosen one. **Done when:** the chosen option works end-to-end (`curl` the previously-404 routes), or broken surfaces are behind flags.
- [ ] **Step 7 — Repoint dead `fly.dev` defaults.** `cmd/gizzi-code/src/runtime/context/flag/flag.ts:71` default → `https://api.allternit.com`; grep the web surface for `allternit-cloud-api.fly.dev` fallbacks and repoint the same way. Keep env overrides working. **Done when:** grep for the dead host returns only changelog/history references.
- [ ] **Step 8 — `_redirects` static-asset fix (C1, confirmed live).** In `surfaces/ai.allternit.com/public/_redirects` add explicit 200 pass-throughs (matching the existing style) for: `/benchmarks/*`, `/bonsai-webgpu-worker.js`, `/desktop-cloud-admin.html`, `/desktop-cloud-admin.js`, `/plugin-manager-demo.html`, `/favicon.ico`. Then diff every file/dir in `public/` against the rules list — anything not covered by a rule or an existing directory rule gets one (the file's own header comment states the invariant). **Done when:** deploy preview (or `npx wrangler pages dev public/`) shows each path serving its real asset, and `curl https://ai.allternit.com/benchmarks/index.html` returns HTML > 4202 bytes.
- [ ] **Step 9 — P0 closeout.** Re-run every verify command from Step 0; paste before/after into the checkpoint; write the session attestation per AGENTS.md (dated summary in `agent-ledger/summaries/` + `LEDGER.md` entry). Hand the secrets rotation list and the Step 6 decision to the user.

## P1 — next session (desktop track)

- [ ] **Step 10 — Desktop staging pipeline.** Recreate `scripts/build-desktop.sh` (referenced by `verify-packaged-resources.cjs:73`, `docs/SIGNING.md:113`, `BUILD.md:134` but missing) — fold in: `prepare:platform-static`, `prepare:cua-driver`, `download:lima` (darwin only), `prepare:mesh-node`, `prepare:office-engine`, `prepare:api-binary`, `stage:api-binary`. Resolve `allternit-voice-service` (no source in repo): find where it was built (check `~/Desktop/allternit-workspace` siblings, ask user) or remove it from `verify-packaged-resources.cjs:43-46`.
- [ ] **Step 11 — Platform gating.** Darwin-gate: `lima.ts` bundled-binary preference, `vm-setup:*` IPC, Bonsai companion (`bonsai-companion-manager.ts` — macOS paths, `bash install.sh`), cua-driver extraResources, dictation-helper. Wire the existing-but-dead `platform.ts` autostart layer (`unified-main.ts:1918-1921`). Add `build/tray-icon.png`. **Done when:** a dry `electron-builder --win --dir` and `--linux --dir` complete without Mach-O contamination in the output (spot-check with `file`).
- [ ] **Step 12 — CI honesty + Linux job.** `npm run typecheck` as a hard gate in `ci-desktop.yml`; `notarize.cjs` fails loudly when env vars are missing on release builds; add `build-linux` job to `release-desktop.yml`; `--publish never` on build jobs + single release job (fix the double-publish race at :170/:286/:330).
- [ ] **Step 13 — Prepare release mechanics.** Bump version, write `surfaces/allternit-desktop/CHANGELOG.md`, prepare tag `desktop-vX.Y.Z`. Ask user to create `allternit/desktop` repo + Apple signing cert (lead time). Do NOT publish.
- [ ] **Step 14 — App hardening (from A3).** Crash handlers (`uncaughtException`/`unhandledRejection`/`render-process-gone` → electron-log), startup-window contextIsolation (`startup-window.ts:304-306`), `open-external` scheme allowlist (`:2118-2120`), CSP via `onHeadersReceived`, `setPermissionRequestHandler`. Each is small and independent — do them in one commit each, tests green.

## P2 — first week (do NOT start before P0/P1 are verified)

- [ ] Electron 41 → 43/44 (EOL security fixes) + re-audit webPreferences.
- [ ] Desktop Windows updater: migrate `update-electron-app` → `electron-updater` (NSIS-compatible), fix publisherName vs SIGNING.md, `verifyUpdateCodeSignature: true` once a cert exists.
- [ ] gizzi-code Phase 0 (A4 plan items 1–8): hangs/timeouts, `db.ts` bundler fix, dead cloud default (done in Step 7), triage 86 `bun audit` vulns, test gate restore, release smoke test.
- [ ] Docs reconciliation: rewrite AUDIT.md/ARCHITECTURE.md/README.md/BUILD.md/SIGNING.md against current code; one canonical platform domain; desktop version-lock doc.
- [ ] Websites repo (separate): labs.allternit.com Pages binding, www hero CTA decision, robots/sitemap/404 for 13 sites, dead-domain sweep.

## If you get stuck

- A **Verify** command doesn't reproduce → the finding may be stale; check `git log` since `88baa91ab` and mark it accordingly in the checkpoint — do not "fix" something that isn't broken.
- The steering gate rejects a commit → update `.steering/checkpoint.md` with evidence and wait; do not force-push or bypass (`STEER_GUARD_OFF=1` is for the human orchestrator only, not you).
- Anything requiring credentials, org permissions, or money (certs, repos, rotation) → stop and ask the user. This plan deliberately routes all such items through explicit user decisions.


---

# Addendum — Operations Notes for the Executor (complements the Execution Guide)

The Execution Guide above is the step order of record. This addendum supplies what it deliberately leaves out or references only briefly. Do not reorder or renumber the Guide's steps.

## A. Baseline snapshot (run once, before Step 0 modifications)

Archive these next to your checkpoint so before/after evidence exists for every P0 item:

```bash
gh run list --workflow deploy-cloud-api-contabo.yml --limit 6
gh run list --workflow deploy-cloudflare-pages.yml --limit 3
gh run list --workflow ci-desktop.yml --limit 3
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer dev-api-token" \
  https://api.allternit.com/api/v1/auth/me            # expect 200 (backdoor open) — must become 401 after deploy
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' \
  https://ai.allternit.com/benchmarks/index.html      # expect 200 text/html 4202B (SPA fallback) — must serve real HTML after Step 8 deploy
npx tsc --noEmit -p surfaces/allternit-desktop/src/main/tsconfig.json 2>&1 | grep -c 'error TS'
npx tsc --noEmit -p surfaces/allternit-desktop/src/preload/tsconfig.json 2>&1 | grep -c 'error TS'
curl -s -o /dev/null -w '%{http_code}\n' https://api.allternit.com/api/jobs   # expect 404 — tracks Step 6 decision
```

## B. Production deploy & verification sequence (the Guide's human-gated steps, made concrete)

The Guide routes deploys through the user. When the user says "deploy," this is the exact sequence and expected evidence for each **[PROD]** marker:

1. **Backdoor closure (after Guide Step 5 merges):** cloud-api deploys via `scripts/deploy-cloud-api.sh` (or the Contabo workflow once Step 3 fixes CI). Post-deploy verification: the backdoor curl above → **401**; `curl -s https://api.allternit.com/api/v1/health/ready` → `{"ready":true,...}`; and one authenticated happy-path call with a real scoped `alt_` token → 200. If health is not ready within the deploy script's own health-check window, the script auto-rolls back — report that, do not retry by hand.
2. **Web surface redeploy (after Steps 2+8 merge):** push to main triggers `deploy-cloudflare-pages.yml`. Post-deploy: the `/benchmarks/index.html` curl above returns real HTML (>4202 bytes, distinct from a guaranteed-404 URL's body); `curl -sI https://ai.allternit.com/favicon.ico` → 200 image content-type; sign-in flow reachable at `/sign-in`.
3. **iOS coordination warning:** the iOS app in the field ships the `dev-api-token` hardcoded (B1). The moment step 1 deploys, those app builds lose API access. Sequence the merge so the iOS fix (build-config value) is at least in review before the backend deploy lands — flag this timing to the user explicitly.
4. **Do not** run `wrangler pages deploy` by hand from any directory while the stale `surfaces/ai.allternit.com/wrangler.toml` (wrong project `allternit-platform`, wrong dir `out`) is unfixed — Guide Step "config corrections" must land first or the wrong site gets pushed to the wrong project.

## C. gizzi-code Phase 0 — concrete step list (Guide P2 references A4's plan; here is the executable subset)

Order matters; each step is committable independently:

1. **Timeouts:** add `AbortSignal.timeout(8000)` to the subprocess probe spawn (`src/runtime/providers/discovery/subprocess.ts:538`), the `.well-known` per-entry fetch (`src/runtime/context/config/config.ts:87`), and the `apiFetch` wrapper. Gate the `bun install` call in `Config.get()` (`config.ts:177`) behind an explicit flag. **Verify:** `gizzi provider list` and `gizzi doctor` exit on their own with no network.
2. **Bundler fix:** `import type { SQLiteTransaction }` in `src/runtime/session/storage/db.ts:6`. **Verify:** fresh `bun run build` → `dist/gizzi-code --version` runs.
3. **Dead default:** already covered by Guide Step 7 (`flag.ts:71`) — do not duplicate.
4. **Audit triage:** run `bun audit`; upgrade `@modelcontextprotocol/sdk` (GHSA-345p-7cg4-v4c7) and `seroval` first; add `bun audit` to the release workflow with a triaged-unfixed allowlist.
5. **Test gate:** recreate `cmd/gizzi-code/bunfig.toml` (`[test] preload = ["./test/preload.ts"]`); change the `test` script from the echo-stub to `bun test --timeout 30000`; quarantine genuinely flaky files into an allowed-to-fail CI job; add typecheck + test + smoke to `release-gizzi-code.yml` and `publish-gizzi-code-npm.yml`.
6. **Release smoke:** CI job after build runs the artifact `--version` and `exec "say hi" --ci` (must exit <60s with output). **Verify:** deliberately break the build once to confirm the gate catches it, then revert.
7. **npm packaging fix:** include the real binary (or a launcher `bin/gizzi` JS shim) in `files`, resolve `workspace:*` refs before publish, and add a publish-time `npm pack --dry-run` + bin-exists check to the workflow. **Verify:** `npm install -g` from the dry-run tarball in a clean container, then `gizzi --version`.

Stop conditions for this list: if step 5's quarantine grows past ~20 files, stop and checkpoint — the suite needs triage judgment, not bulk-skipping.

## D. Marketing-sites repo — concrete step list (separate worktree, that repo's own conventions)

1. `labs.allternit.com`: inspect the Pages project's domain binding (wrong app — Husks robot sim — is being served). Rebind to the correct project or fix the Pages project's output. **Verify:** `curl -s https://labs.allternit.com/ | head -20` shows the learning platform, not the sim.
2. `3dfacility.allternit.com`: user decision — deploy a placeholder page today or remove the uncommitted hero CTA from www. Do not commit the CTA while the target 404s.
3. Homebrew cask (`PLACEHOLDER_INTEL_SHA256`): either build the Intel binary and fill the real sha or remove the Intel stanza.
4. platform.allternit.com: verify the prerendered auth-route HTML survives the workspace sync before its next deploy; add a CI check that the files `_redirects` points at exist in `dist/`.
5. Sweep: robots.txt/sitemap.xml/404.html for the 13 sites missing them; dead-domain content sweep (`app.allternit.com` ×16, `games.allternit.com` ×5).

## E. Stop conditions (whole engagement)

Halt, write the checkpoint, and surface to the user if any of these occur:

- A Verify command doesn't reproduce and `git log` since `88baa91ab` doesn't explain it (possible concurrent fix — reconcile, don't fight).
- Lockfile regeneration pulls unexpected major upgrades that break a surface build (human decides: pin or upgrade).
- The steering commit gate rejects twice on the same evidence (escalate; do not bypass).
- Any new live-exposure discovery beyond the known findings (secrets reachable in prod, data leak) — stop everything, this outranks the launch checklist.
- The user has not yet decided Guide Step 6 (routing story) by the time Steps 1–5, 7–8 are done — stop there; do not pick a routing option unilaterally.


---

# Addendum 2 (2026-09-03) — Step 6 decided: option (b), control-plane/data-plane split

The owner decided the routing story. Full rationale, prior-art research (DevPod,
OpenCode, E2B, Codespaces, Tailscale), and the revised work list:
**`docs/Architecture/2026-09-03-control-plane-data-plane-decision.md`**.

Headline decisions:
- **(b) chosen:** cloud-api is the single public API; the 8013 routes are mounted
  into it over time (P1). No second public gateway, no feature-flag-off.
- **Interim (P0):** nginx on `mail` proxies the known 8013-owned prefixes to
  127.0.0.1:8013 so the console stops 404ing while migration proceeds. Snippet:
  `infrastructure/vps-desktop-cloud/nginx-api-allternit-interim-proxy.conf`
  (verified non-colliding against cloud-api's route table; deploy owner-gated).
- **Long term (P2):** per-sub data-plane instances — Allternit provisions an
  Incus container per subscription via an init script; the same allternit-api
  binary serves all three lanes (local desktop / user-paired BYO box /
  Allternit-provisioned). SQLite stays per-instance (decision D3).
- The existing VPS 8013 remains the company's own Desktop-Cloud control plane,
  not a user-facing surface.

Step 6's stop condition ("do not pick a routing option unilaterally") is satisfied;
the remaining P0 item before the proxy deploy is hardening 8013's CORS mirror-any-origin.
