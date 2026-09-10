# Bot-desktop API ergonomics fixes (bugs 6–8) — session/botmode-api-0910

**Agent:** kimi-code · **Date:** 2026-09-10 · **Branch:** `session/botmode-api-0910`
**Outcome:** ✅ LANDED — three Rust API bugs documented by session/botmode-0910 (PR #262) are code-fixed, unit-tested (72/0 in bot_desktop suites), and proven live against an isolated API driving the real Tart host.

## Bug 6 — default provision dead-ended on Tart-only hosts

A bare `POST /bots/:id/desktop/provision` defaulted `os` to `linux`, which the substrate router sent to Incus — a dead "Feature not supported: Incus substrate" on hosts that only have Tart.

- `cmd/allternit-api/src/bot_desktop_templates.rs`: the default OS now matches the configured substrate (`pick_default_os(incus, tart)`): Tart-only → `macos`, otherwise `linux` (Incus present, both, or neither).
- `cmd/allternit-api/src/bot_desktop_routes.rs`: a `DriverError::NotSupported` from spawn now carries an explicit hint — pass `?os=macos&provider=tart` (or the Incus pair) or configure the missing substrate.

## Bug 7 — provision params were query-only; a JSON body was silently ignored

`provision_desktop` now also accepts an optional JSON body (`ProvisionDesktopBody`: os, template_id, cpu_cores, memory_mb, disk_mb, resolution, provider). Body fields fill gaps; explicit query params win. Body-only callers now hit validation (e.g. a bad `resolution` returns 400) instead of having their input dropped.

## Bug 8 — `sandbox_id` was required on every desktop route

`DesktopQuery.sandbox_id` is now optional. `resolve_sandbox_id` (bot_desktop_routes.rs, `pub(crate)`) falls back to the bot's persisted sandbox record and only 400s when neither a query param nor a persisted record exists. Applied to: status, screenshot, start, stop, destroy, observe, take-over, hand-back, mux run, mouse, keyboard, file download/upload. (Pause/resume forward unchanged; the VNC ws route builds its URL with the sandbox id embedded, so it always has one.)

## Verification

- **Unit:** `cargo test -p allternit-api bot_desktop` → **72 pass / 0 fail**, including 7 new tests: bare-route status/start/observe fallback, 400 when no record, JSON-body validation 400, query-wins-over-body, and the `pick_default_os` matrix.
- **Full suite:** `cargo test -p allternit-api --lib` → 830 pass, 4 fail — all four are `agent_cloud_routes::…_through_real_os_control_plane`, which spawn `/Users/joe/Desktop/AllternitOS/target/debug/allternitos_control_plane` and fail identically on clean main in the shared checkout (pre-existing environment issue, unrelated to this diff).
- **Production config:** `cargo build -p allternit-api --release` green (AGENTS.md #4).
- **Release gate:** `node scripts/release-preflight.mjs` → 35 passed / 0 failed.
- **Live probe** (isolated API on :18013, worktree release binary, `TART_HOST_URL=http://100.88.98.69:8020` + token, `BOT_DESKTOP_IMAGE=allternit-desktop`, local-dev bypass):
  - Bare `POST .../desktop/provision` (no params, no body) → 200 `provider:"tart"`, real VM spawned; API log: `Routing desktop spawn to substrate os=macos`.
  - JSON body `{"resolution":"9999x9999"}` on a fresh bot → 400 `resolution must be one of [...]`.
  - Bare `GET .../desktop` (no `?sandbox_id=`) → 200 with the persisted `sandbox_id`.
  - Cleanup: deprovision 204, bot deletes 200, Tart host has no lingering bot VMs.

## Notes / honest observations

- The live run surfaced (again) the pre-existing account-computer reuse quirk documented in the botmode-0910 summary: with no resource params, provision reuses the shared account-computer row even when the underlying VM was destroyed, and reports `status:"running"` while the endpoint truthfully reports `off` ("Desktop endpoint is not reachable"). Not introduced by this change; callers wanting a guaranteed-fresh spawn should pass `resolution` or another resource param. Bug 9 from the earlier session (OAuth through the dev `/__clerk` proxy 403s) remains documented, not fixed — it's a Clerk dashboard redirect-origin config, not code.
- Desktop rebuild (AGENTS.md step 8) deferred per owner until all bot-mode work is done.
