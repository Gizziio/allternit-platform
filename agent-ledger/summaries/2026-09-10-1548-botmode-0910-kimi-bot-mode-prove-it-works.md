# Bot mode — prove it works on all four surfaces — session/botmode-0910

**Agent:** kimi-code · **Date:** 2026-09-10 · **Branch:** `session/botmode-0910`
**Outcome:** ⚠️ PARTIAL — 5 real bugs found & fixed (PR'd from this branch), gizzi-code CLI bot mode proven green (suites + live smoke), web sign-in path proven once end-to-end. Clerk-gated phases (web e2e flows, PWA, desktop-UI e2e, CLI chat turn) PARKED per owner directive — another session (`allternit-session-desktop-clerk-proxy-20260910`) is actively fixing Clerk login; those phases transfer to that session, they are deferred, not failed. Bot-computer substrate provisioning proven at the lifecycle level against a live Tart host; live VNC stream blocked by an environment gap (bare golden image), root cause confirmed by exec inside the VMs.

## Why

Owner decision (2026-09-10): bot mode (B1–B5, PR #121) must be proven working on all four surfaces — gizzi-code CLI, ai.allternit.com web, the PWA, and the packaged Desktop app — against **LIVE api.allternit.com**, full depth (chat + groups + routines/messaging + computer viewport). Approved plan: `.steering/plan-botmode-0910.md`.

## Verification matrix

| Surface | Result | Evidence |
|---|---|---|
| gizzi-code CLI — bot suites | ✅ PASS | 144 pass / 0 fail (`bun test test/runtime/bots/ test/cli/bot.test.ts test/cli/bots-pane.test.ts`) |
| gizzi-code CLI — live smoke | ✅ PASS | `bot create/list/show/edit` + `routine add/list/remove` against real `~/.gizzi`; chat bootstrap fix landed (live turn was Clerk-gated, parked) |
| ai.allternit.com — sign-in path | ✅ PASS (once) | Seed sign-in reached 200 on `/api/v1/agents` against live cloud API — proves the `/__clerk` proxy + clerkJSUrl + ordering fixes end-to-end |
| ai.allternit.com — bot flows | ⏸️ PARKED | Bot Hub → 1:1 → group → rail layout harness (`bot-e2e-live.cjs`) ready + self-seeding; Clerk 429 + owner park directive |
| PWA | ⏸️ PARKED | `bot-e2e-pwa.cjs` ready (standalone display-mode emulation) |
| Desktop app — UI e2e | ⏸️ PARKED | `bot-e2e-desktop-live.cjs` ready (Playwright-launches installed app, TART env propagation check, typed-credential auth) |
| Bot computer — substrate | ✅ lifecycle PASS / stream BLOCKED | Real Tart VM cloned from golden image + running in seconds; status/deprovision/delete clean; ws_url never appears — see "Substrate probe" below |
| Release preflight | ✅ PASS | `node scripts/release-preflight.mjs`: 35 passed / 0 failed (check set grew past the AGENTS.md-cited 26; green either way) |

## Fixes landed (commit `260a29d8a`)

1. **Vite dev had no `/__clerk` proxy** (`surfaces/ai.allternit.com/vite.config.ts`) — with real Clerk keys in dev, ClerkJS loaded cross-origin but the app's own `/__clerk/...` calls 404'd; dev sign-in could never complete. Added a dev-only `/__clerk` proxy (rewrite + `Origin: https://ai.allternit.com` shim, which Clerk allowlists).
2. **clerkJSUrl forced an https origin** (`platform-auth-client.tsx`) — the dev proxy only exists on http://localhost:3013; added `clerkJSUrl={`${window.location.origin}/__clerk/npm/...`}`.
3. **Seed sign-in ordering** — `setActive({session})` now runs before org reads/creates.
4. **SeedAuth multi-fire** — the seeded auto-login effect fired `signIn.create` ~3× per page load (Clerk object identity churn across renders), multiplying rate-limit pressure; fixed with a `seedAttemptedRef` one-attempt-per-load guard.
5. **gizzi-code headless `bot chat` bootstrap** (`cmd/gizzi-code/src/cli/commands/bot.ts`) — headless print-mode chat never initialized the runtime the turn needs ("No context found for instance"); wrapped subscribe+RunCommand in `bootstrap(projectPath)`.

## Bugs found, documented, NOT fixed in this PR (follow-up candidates)

6. **Default bot-desktop provision routes `os=linux` → Incus** — on a Tart-only host this is a dead "Feature not supported: Incus substrate" with no hint to pass `os=macos&provider=tart`.
7. **Provision params are QUERY params, not a JSON body** (`ProvisionDesktopQuery` via axum `Query`: `os`, `provider`, `template_id`, `cpu_cores`, `memory_mb`, `disk_mb`, `resolution`); a JSON body is silently ignored. Undocumented; likely bites the platform UI's `ensureBotComputer` too.
8. **`GET /bots/:id/desktop` and `/screenshot` require `?sandbox_id=`** — without it: 400 "Failed to deserialize query string: missing field `sandbox_id`".
9. **OAuth (Google) sign-in through the dev `/__clerk` proxy 403s** — Clerk OAuth redirect origins don't include `localhost:3013` (deployed https origin only). Password sign-in unaffected.

Decision recorded: these are Rust API ergonomics changes — a separate concern from the 3-file platform fix — so they are documented here as follow-ups rather than folded into this PR.

## Substrate probe (Clerk-independent, isolated API on :18013)

Ran `botmode-substrate-probe.cjs` against the bundled desktop-v1.1.1 `allternit-api` with `TART_HOST_URL=http://100.88.98.69:8020` (Tailscale-only bind; `127.0.0.1:8020` does not reach it) + `TART_HOST_TOKEN` from `~/.allternit/tart-host.env`, `BOT_DESKTOP_IMAGE=allternit-desktop`, `ALLTERNIT_LOCAL_DEV_BYPASS=1`:

- ✅ Tart driver initialized; substrate router initialized; localhost no-auth bypass works (`/api/v1/agents` 200).
- ✅ `POST /bots/:id/desktop/provision?os=macos&provider=tart&resolution=1280x720` → 200; real Tart VM cloned from the golden image and running in ~3s.
- ✅ Poll, screenshot route, and cleanup all behaved: deprovision 204, bot delete 200, `tart list` clean afterwards.
- ❌ `ws_url` never appeared (10 min poll): `last_error:"Desktop endpoint is not reachable"` — the Tart driver only advertises VNC when tart-host reports a per-VM `vnc_port` guest-VNC forward (`cmd/allternit-computer-cloud/src/tart.rs:425-464`).
- **Root cause confirmed by exec into the VMs** (tart-host `/v1/vms/:name/exec`, user `admin`): both the spawned clone AND the golden `allternit-desktop` VM itself are **bare Ubuntu 22.04 aarch64** with only `tart-guest-agent --run-rpc` running — no desktop environment, no Allternit desktop agent, no VNC server. The image on this host was never provisioned with the desktop stack, so no guest-VNC forward can ever be registered. This is an environment/golden-image gap, not an API bug: the provision→status→deprovision lifecycle is correct.
- Corollary: provisioning was also attempted with no resource params first; the reuse path can attach a bot to a stale/deleted sandbox and report `running` while status says `off` — pass `resolution` (or another resource param) to force a fresh spawn. The probe script encodes this.
- Open question left for the golden-image owner: whether the in-guest desktop agent can call back to an arbitrary host:port (determines whether an isolated-API provision can ever yield `ws_url`, or whether that proof must run against the desktop app's own :8013).

## Incidents

- **Clerk sign-in 429 (~12:00–14:30 CDT):** 17+ sign-in attempts tripped Clerk's per-account/IP limiter. Root causes: the SeedAuth multi-fire bug (fixed, #4) multiplied attempts ~3×, and every harness run without saved storageState forced a fresh sign-in. Mitigations in place: one-attempt guard, `/tmp/botmode-e2e-state.json` storageState reuse, `/tmp/botmode-clerk-token` (0600) JWT hand-off, 429 backoff in the desktop harness. **The account needs a cooldown before any new sign-in attempts.**
- **Owner directive (~15:05 CDT):** "someone is actively working on clerk login so skip this now." All Clerk-gated phases parked and transferred; this session deliberately did not touch :8013, the desktop app, or vite :3013 sign-in paths afterwards.

## Harness scripts landed (repo root, repo convention)

`bot-e2e-live.cjs` (live web e2e, self-seeds Echo Alpha/Echo Beta), `bot-e2e-pwa.cjs` (PWA standalone emulation), `bot-e2e-desktop-live.cjs` (installed-app Playwright harness), `botmode-computer-provision.cjs` (data-plane provision→poll→screenshot→VNC), `botmode-substrate-probe.cjs` (isolated-API substrate probe — the one harness that ran end-to-end). All `node --check` clean; module resolution falls back to the shared checkout's node_modules via `requireDep()` (session worktrees have no node_modules).

## Honest deferrals

- Web bot flows / PWA / desktop-UI / CLI chat turn: parked on Clerk, owned by the desktop-clerk-proxy session.
- Live VNC desktop stream: blocked on a golden image that actually contains the desktop agent; lifecycle proven.
- Desktop bundle rebuild (AGENTS.md step 8): the fixes ride in the desktop's bundled web app, so a rebuild is due — deferred while the other session is active in the desktop area.
- `.env.local` (gitignored live Clerk config) was modified locally for the sweep; backup at `.env.local.bak-botmode-0910` — restore decision is the owner's.
- Worktree had no node_modules: the web surface's own `tsc --noEmit` was not run; release-path gate is covered by preflight 35/0 + byte-identical fix-file diffs.
