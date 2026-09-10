# Steering checkpoint — session/botmode-0910 (update 1)

> Merge note (2026-09-10): both session/botmode-0910 and session/desktop-clerk-proxy-20260910
> updated this file; both histories are preserved below (botmode first, clerk-proxy after
> the `---` separator).

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

# Update 4 — 429 root-caused, probe strategy changed (2026-09-10 ~13:45 CDT)

Just did:
- Diagnostic run (botmode-signin-diagnose.cjs, one load): confirmed failures are Clerk 429 "too_many_requests" on POST /__clerk/v1/client/sign_ins — NOT a password/config error.
- FOUND BUG 6: seeded auto-login effect fired signIn.create 3x per page load (deps clerk/signIn/setActive change identity across renders). Fixed in shared checkout + worktree: seedAttemptedRef guard = max 1 attempt per load. Files in sync.
- Stopped probe bash-hj6wy65b (5 failed attempts; each may extend the 429 window). New task bash-ca58adv8: zero attempts until 14:00, then 3 spaced single attempts (14:00/14:10/14:20).
- botmode-computer-provision.cjs: BOT_NAME default now 'Echo Alpha' (self-seeded clerk-test bot, not Eoj's echo-bot-alpha).
- Worktree: commit 260a29d8a pushed (3 fix files + plan + checkpoint). tsconfig typecheck of platform edit in flight (bash-rkeagm0z).

Next (on probe success): bot-e2e-live.cjs full run → CLI chat turn w/ saved token → bot-e2e-pwa.cjs → desktop restart + bot-e2e-desktop-live.cjs → computer provision + VNC → PR + ledger.

Open questions: none.

# Update 5 — Phase 6 prep swarm landed (2026-09-10 ~13:55 CDT)

Just did (swarm, nothing committed):
- 4 harness scripts polished + landed at worktree repo root (repo convention — the old bot-e2e-*.cjs live there tracked): bot-e2e-live.cjs, bot-e2e-pwa.cjs, bot-e2e-desktop-live.cjs, botmode-computer-provision.cjs. requireDep() fallback borrows shared-checkout node_modules (worktree has none). node --check 4/4. Dead code removed (apiPid placeholder, dup RESULT.api).
- Release preflight from worktree: 35 passed / 0 failed (check set grew past the AGENTS.md-cited 26 — green either way). Desktop-release-path gate is satisfied for the fix commit.
- Fix-file sync verified byte-identical (shared vs worktree) for all 3 fixed files.
- Attestation skeleton: agent-ledger/summaries/2026-09-10-1530-botmode-0910-kimi-bot-mode-prove-it-works.md (placeholder time, PENDING sections marked, no LEDGER.md line yet).
- Swarm agents observed task-duplication collision (all three executed the full list) — resolved cleanly, final state verified; serialize path ownership next time.

Next: probe bash-ca58adv8 attempt 1 at 14:00 CDT. On success: web e2e full run → CLI chat → PWA → desktop → provision → finalize attestation → PR → ledger.

# Update 6 — manual sign-in capture (2026-09-10 ~15:05 CDT)

Just did:
- clerk-test remains hard rate-locked (attempts at 14:00/14:11/14:23 all 429; ~17 total attempts). Owner chose to sign in MANUALLY with his own account.
- v1/v2 capture scripts had flaws: v1 died on navigation-destroyed context; v2 lost the session when killed (no persistent profile). Owner signed in in the v2 window but no token ever landed (cause unrecoverable — window closed without logs).
- v3: launchPersistentContext(/tmp/botmode-chrome-profile) — session survives tooling restarts; console + Clerk 4xx response logging; periodic probe logging. Window sits at /sign-in; relaunched with 60-min idle (bash-nndd1r9p).
- api-client confirmed: setToken writes localStorage 'allternit_token'; probe requires /api/v1/agents 200 to save.

Next: on capture → web e2e → CLI chat → PWA → desktop → provision. If the v3 attempt also yields no token after a confirmed-complete sign-in, the manual-signin→token-sync path is a real app bug and needs the v3 console diagnostics to debug.

# Update 7 — Clerk parked, substrate probe findings (2026-09-10 ~15:25 CDT)

Just did:
- Owner: "someone is actively working on clerk login — skip this now." Web/PWA/desktop-UI/CLI-chat phases PARKED. Another session's worktree exists: allternit-session-desktop-clerk-proxy-20260910 (running its own dev desktop + api). Do not touch :8013, the desktop app, or vite :3013 sign-in paths.
- Clerk-independent Phase 5 substrate verification (isolated :18013, own data dir /tmp/botmode-api-data, ALLTERNIT_LOCAL_DEV_BYPASS=1, bundled desktop-v1.1.1 allternit-api binary):
  1. TART_HOST_URL=http://100.88.98.69:8020 + TART_HOST_TOKEN (from ~/.allternit/tart-host.env) → "Tart driver initialized" + "Substrate router initialized". Driver wiring confirmed — desktop's only gap is missing env at spawn.
  2. Local-dev bypass auth works: /api/v1/agents no-auth from localhost → 200.
  3. BUG 7 (real): default provision (no params) routes os=linux → Incus → "Feature not supported: Incus substrate" — dead end on a Tart-only host; the API error gives the caller no hint to pass os=macos/provider=tart.
  4. BUG 8 (real): provision params (os, provider, template_id, cpu/memory/disk, resolution) are QUERY params (ProvisionDesktopQuery via axum Query), NOT JSON body — body silently ignored. No caller docs; the platform UI's ensureBotComputer may hit this too.
  5. os=macos&provider=tart routes correctly ("Routing desktop spawn to substrate os=macos") but default image "tart-ubuntu-test" doesn't exist on the tart host → Internal driver error. Available: allternit-desktop (the golden image), ubuntu OCI images.
  6. Relaunched with BOT_DESKTOP_IMAGE=allternit-desktop (supported env override in resolve_provision_spec) — provision running now (bash-7oj5tza0).
- OAuth (Google) sign-in through the dev /__clerk proxy 403s: Clerk OAuth redirect origins don't include localhost:3013 (works on the deployed https origin only). Password sign-in unaffected.

Next: finish substrate probe (poll → ws_url → screenshot → VNC handshake → deprovision + delete probe bot). Then Phase 6: land BUG 7/8 notes into the summary; PR the 3-file fix; ledger.

# Update 8 — substrate probe final + session finalization (2026-09-10 ~15:48 CDT)

Just did:
- Probe bash-am6pm3yc completed: provision 200 (real Tart VM in ~3s), 10-min ws_url poll never satisfied, cleanup clean (deprovision 204, bot delete 200, tart list empty).
- ROOT CAUSE of no ws_url confirmed by exec into both the spawned clone and the golden `allternit-desktop` VM (tart-host exec, user admin): both are bare Ubuntu 22.04 aarch64 with only tart-guest-agent — no desktop env, no Allternit agent, no VNC. Environment/golden-image gap, not an API bug. Lifecycle (provision/status/deprovision) is correct.
- Attestation finalized: agent-ledger/summaries/2026-09-10-1548-botmode-0910-kimi-bot-mode-prove-it-works.md (placeholder 1530 file removed). Bugs 6-9 documented as follow-ups (Rust API ergonomics — deliberately NOT in this PR). botmode-substrate-probe.cjs (the harness that actually ran) copied into worktree for landing.
- Parked phases recorded as deferred to the desktop-clerk-proxy session.

Next: commit + push worktree (harness scripts + probe + summary + checkpoint), gh pr create + merge, ledger attestation + LEDGER.md in shared checkout, cleanup (isolated API on :18013, /tmp/botmode-*, ~/.gizzi/bots/e2e-smoke, scratch .cjs in shared root, worktree+branch after merge).

Open questions for owner: (1) bugs 6-8 — code-fix as follow-up vs leave documented; (2) restore .env.local from .env.local.bak-botmode-0910? (3) desktop rebuild timing (deferred while other session is in that area).

---

# Checkpoint — session/desktop-clerk-proxy-20260910

## Goal
Fix desktop Clerk GitHub OAuth (authorization_invalid → Vercel 404) and land via merge.

## Just did
- Root cause proven by controlled experiments (E2/E3): Clerk's /v1/oauth_callback
  exchange only succeeds as a real browser navigation carrying the attempt-bound
  __client cookie; the old flow loaded the callback in the protocol-handled auth
  window where partition cookies are stripped from real navigations.
- Rewrote src/main/clerk-oauth-popup.ts: default-session popup, copy attempt
  __client from auth partition pre-flight, webRequest pre-dispatch detection of
  success (redirect to accounts.allternit.com/__desktop_auth__ — note: FAPI does
  NOT append created_session_id for clerk-js-created attempts) and failure
  (err_code), signed-in cookies handed back into the auth partition, auth window
  reloads so TokenBridge completes pairing.
- Live smoke PASSED: GitHub authorize → exchange → Clerk token → pairing
  lookup/approve/exchange 200 → identity saved → relay connected.
- typecheck ✓ build:main ✓ release-preflight 35/0 ✓

## Next
- Commit + push + PR + merge; sync main; ledger attestation; rebuild desktop preview; cleanup.

## Open questions
- Instance-proxy config (option 2, company.json clerkProxyUrl) rides along as approved.
