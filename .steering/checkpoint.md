# Steering checkpoint — session/botmode-0910 (update 1)

Goal: Prove bot mode works on all four surfaces against LIVE api.allternit.com, full depth.

Just did:
- Worktree created; plan approved.
- Phase 1: gizzi-code bot suites 144/0 pass (after building sdk dist — root node_modules/@allternit/gizzi-sdk symlinks into allternit-desktop-preview worktree whose packages/sdk/dist was unbuilt).
- Live CLI smoke: `gizzi bot create/list/show` work; canonical session created+pinned (ses_f73afd8d7ffehz1CL21k6PoUdx).
- FOUND BUG 1: headless `gizzi bot chat <name> <msg>` fails "No context found for instance" — bot.ts:392 bootstrap wraps only openCanonicalChat; RunCommand.handler at :440 then runs outside... but RunCommand bootstraps internally with process.cwd(). Root cause under investigation (direct `run -s <id> --print` repro running).
- Phase 2: .env.local switched to live Clerk (pk_live + seed creds + AGENT_SESSIONS_API=1 + cloud API URLs); vite restarted.
- FOUND BUG 2: vite dev had no /__clerk proxy though platform-auth-client always proxies Clerk same-origin -> ClerkJS never loads in dev. Fixed vite.config.ts (+/__clerk proxy w/ rewrite) in shared checkout; clerk-js now 200 via proxy. To be landed via this branch's PR.
- bot-e2e-live.cjs (auth-aware adaptation of bot-e2e-verification.cjs) created at repo root (scratch; polish + land via PR later).

Next: live web e2e run 3 (Clerk fix in place); CLI run-with-session repro; then fix bot chat headless path in this branch.

Open questions: none — owner provided Clerk creds and desktop sign-in availability.

## Update 2 — bugs found + fixed (verification copies in shared checkout; to land via PR)
1. vite dev missing /__clerk proxy -> ClerkJS never loads in dev (vite.config.ts: added /__clerk proxy w/ rewrite + Origin shim to https://ai.allternit.com — Clerk allowlists that origin; pk_live production key works against it).
2. Clerk loader forces https for proxy URLs (clerkJsScriptUrl strips scheme) -> added clerkJSUrl prop preserving page origin (platform-auth-client.tsx).
3. Seed sign-in created org before setActive -> "You are signed out" for membership-less accounts; reordered setActive-first (platform-auth-client.tsx).
4. gizzi bot chat headless: Bus.subscribe(Session.Event.Error) + RunCommand ran outside Instance context -> "No context found for instance" (stack via GIZZI_BOT_DEBUG=1 confirmed bot.ts:435 subscribe-time replay). Fixed: wrapped subscribe+run in bootstrap(projectPath) (bot.ts).
5. bot-e2e-live.cjs: auth-aware adaptation; polls until agents endpoint returns 200.

## Status
- gizzi bot suites: 144/0.
- CLI smoke: create/list/show/edit (model pin) work. chat now reaches provider but 401 "Authorization header with Bearer token required" — provider test running; suspect headless CLI lacks the gateway bearer the TUI has.
- Web e2e run 8 in flight (seed flow fixed).
- .env.local: pk_live key + cloud URLs + seed creds (gitignored, backed up as .env.local.bak-botmode-0910).

# Update 3 — Clerk 429 + design-flaw fix + desktop/TART prep (2026-09-10 ~13:00 CDT)

Just did:
- Web e2e run 7 achieved seedSignIn:true + 200 on /api/v1/agents (Clerk shim works end-to-end) but then failed: harness assumed echo-bot-alpha/beta owned by the signed-in user — they are the OWNER's bots; clerk-test's agent list is empty.
- Fixed bot-e2e-live.cjs design flaw: now self-seeds Echo Alpha/Echo Beta via authed POST /api/v1/agents (idempotent by name; valid checklist body: type/model/provider/harness_config{mode:cloud}/enabled_modes[chat]/trust_tier). Syntax-checked.
- Clerk sign-in hit 429 (≈11 attempts this window). Background probe bash-hj6wy65b retries once/5min (8 tries) and writes /tmp/botmode-e2e-state.json + /tmp/botmode-clerk-token on success. DO NOT sign in manually while it runs.
- Desktop/TART recon: desktop app never passes TART env to allternit-api (backend-manager passes process.env through; installed app launched via `open` has none). tart-host (PID 45165) binds ONLY Tailscale 100.88.98.69:8020; API driver needs TART_HOST_URL=http://100.88.98.69:8020 + TART_HOST_TOKEN (loads from ~/.allternit/tart-host.env; token auth enabled). DEFAULT_TART_HOST_URL=127.0.0.1:8020 would not reach it.
- Wrote /tmp/botmode-desktop-restart.sh (quit app + kill orphan Resources/bin/allternit-api + relaunch binary directly with TART env + verify env via ps eww) — bash -n clean, NOT RUN YET.
- Desktop auth uses window.allternit.auth bridge from the auth window (no in-app ClerkJS needed → /__clerk gap is web-dev-only).
- Wrote bot-e2e-desktop-live.cjs: Playwright-launches the INSTALLED app with TART env, types clerk-test creds into the Clerk auth window (429 backoff 5min), self-seeds bots, single+group chat, recents purity, saves token to /tmp/botmode-clerk-token. Syntax-checked, NOT RUN.

Next: when probe succeeds → run bot-e2e-live.cjs (vite :3013 must be running) → CLI chat turn with saved token → bot-e2e-pwa.cjs → desktop restart script + bot-e2e-desktop-live.cjs → computer provision + VNC → PR + ledger.

Open questions: none.
