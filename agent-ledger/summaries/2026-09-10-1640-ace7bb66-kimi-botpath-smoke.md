# Bot-owned cloud_desktop end-to-end smoke (rq-20260909-004 follow-up)

**Session:** ace7bb66 (kimi-code) · 2026-09-10 ~16:15–16:40 local
**Trigger:** owner asked whether bots can now use the cloud computer "every time" — the
bot-owned `create_cloud_desktop` path had been deliberately left unchanged through
Phases 1–5 and never re-run live as a bot. This smoke closes that gap. No code changes.

## What was run (live, this machine, Tart substrate)

API from main @ 1995d43d3 on :8123 (`ALLTERNIT_API_PORT` — :8013/:8014 are owned by the
running Desktop app + its connector sidecar; app left untouched). Env: SELF_HOSTED=1,
LOCAL_DEV_BYPASS=**true** (exact string — see gotcha), TART_BIN, TART_HOST_URLS→test
sidecar on :8021 running the merged-but-undeployed #255 binary (sudo-less validation
instance; launchd sidecar at :8020 untouched).

1. **Bot create** — `POST /api/v1/agents` `{id: smoke-botpath-1, type: bot, is_bot, …}`
   (checklist requires name≥3, desc≥10, type, model, provider, harness_config.mode,
   enabled_modes non-empty, trust_tier). Row landed with `user_id=local-dev-user`.
2. **Bot-owned computer create** — `POST /api/v1/computers` `{kind: cloud_desktop,
   bot_id, os: linux, provider: tart, cpu_cores: 2, memory_mb: 4096, disk_mb: 20480}`.
   First attempt without `provider` failed honestly ("Incus substrate" — router default
   for linux). With `provider: tart`: 201, `status: running`, real Tart VM
   `allternit-bot-012f327c…` cloned from `allternit-desktop`.
3. **DB ground truth** — `computers` row: `owner_type=bot, owner_id=bot_id=smoke-botpath-1`,
   full spec persisted; `computer_cloud_desktop` row with `control_state=bot_controls`.
   GET by returned id 200 (id==sandbox_id on this path, consistent).
4. **Shell** — `POST /bots/:bot_id/desktop/shell` (command is a JSON **array**): real
   guest exec (`apt-get` as user → permission denied, `sudo -n` → exit 0). Installed
   `scrot`, then `xvfb + x11vnc` (base Tart image is plain Ubuntu 22.04 — no desktop
   stack baked; that's image content, not a platform gap).
5. **Screenshot** — `GET /bots/:bot_id/desktop/screenshot`: first 503 honest
   (`scrot: not found`, then `Can't open X display [:99]` — Xvfb wasn't running).
   After provisioning the guest desktop: **200, real PNG 1280×800** (the Xvfb geometry
   we started — bot is looking at its own screen).
6. **VNC data plane (the #255 proof)** — sidecar `GET /v1/vms/:id` reported
   `vnc_port: 15900` (RFB-greeting health gate passed → ssh -L forward live). Bot ws
   `/ws/bots/:bot_id/desktop/vnc?sandbox_id=…&token=…` initially **refused while
   `bot_controls`** — take-over arbitration working as designed ("Bot-only control
   rejects the socket so the bot's VNC session is not accidentally shared"). After
   `POST /bots/:bot_id/desktop/take-over` → `human_controls`: **full RFB 3.8 handshake
   through the whole stack** (greeting, security types [1], result 0, ServerInit
   1280×800 "ubuntu:99") → api ws proxy → Tart driver → #255 ssh -L → guest x11vnc →
   Xvfb. `hand-back` returned `bot_controls`.
7. **Files** — upload `POST …/files/upload?path=/tmp/bot-smoke.txt` (raw body) +
   download `GET …/files/download?path=…`: byte-identical roundtrip.
8. **Lifecycle** — `POST /computers/:id/stop` → Tart VM stopped (driver + DB agree);
   `POST /computers/:id/start` → running, guest rebooted (uptime 0 min), shell works
   again.
9. **Cleanup** — `POST /computers/:id/delete` → soft-delete (`status=deleted`), Tart VM
   removed. Bot agent row deleted (no `DELETE /agents/:id` route exists — direct sqlite).
   Sidecar :8021 and API stopped; Tart back to base images only; Desktop app untouched.
   One honest `desktop_usage` metering row (12 min, ended) left as the billing ledger it is.

## Answer delivered

Yes — the bot-owned path works end to end on current main: create (full specs, owner
parity), shell, files, screenshot, stop/start/delete, human take-over arbitration, and
the VNC stream including the merged #255 Tart forward. Bots were verified AS bots.

## Defect found while smoking (needs owner, NOT fixed here)

**Purpose-`vnc` ws tokens appear unreachable.** `POST /computers/:id/ws-token
{purpose:"vnc"}` mints fine (issue_ws_token even has read_only handling for it), and
`validate_vnc_ws_request` requires an authenticated user for that purpose — but the
only `/:id/vnc` route is `computer_vnc_public_router`, mounted in main.rs **outside**
the auth middleware, where `Option<Extension<AuthUser>>` is always None → 403
"log: vnc token presented without an authenticated user" for any client. The protected
`/ws/computers` router only carries pty+events. Bots are unaffected (their full-control
stream is the protected `/ws/bots/*` route, proven above); anonymous viewers are
unaffected (embed tokens, read-only, proven in #254). Suspected impact: full-control
VNC viewing of *standalone user-owned* computers via `/ws/computers/:id/vnc` —
no consumer was found in surfaces/cli/sdk that exercises this path with a vnc token.
Needs whoever owns computer_ws routing: either mount the vnc route on the protected
router too (merge semantics: protected wins) or accept the token as sole credential for
purpose vnc and drop the user gate.

## Gotchas recorded

- `ALLTERNIT_LOCAL_DEV_BYPASS` must be exactly `true`, not `1` — the desktop-ws-secret
  fallback (`desktop_ws_secret`, bot_desktop_stream.rs:121) string-compares `== "true"`;
  with `=1` every ws-token mint 503s "desktop ws not configured".
- Linux-os computer create on a Tart-only host needs explicit `"provider": "tart"` (or
  os macos) or the router demands Incus.
- Shell endpoint takes `command` as a JSON array (argv), not a string.
- Bot screenshot on a bare image fails honestly (scrot missing / no X) — the platform
  reports it, doesn't fake it. Golden/desktop-baked images won't hit this.

## Evidence

`/tmp/botpath-smoke/` — create.json, desktop-status.json (signed ws_url), shot.png
(real 1280×800 PNG), upload/download roundtrip files, api.log. (tmp — may not survive reboot)
