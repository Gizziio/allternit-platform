# Plan — session/botmode-api-0910: bot-desktop API ergonomics fixes (bugs 6–8)

Follow-up to session/botmode-0910 (PR #262). Code-fix the three Rust API bugs
documented in `agent-ledger/summaries/2026-09-10-1548-botmode-0910-kimi-bot-mode-prove-it-works.md`.

## Bug 6 — default provision dead-ends on Tart-only hosts

`resolve_provision_spec` defaults `os` to `"linux"` → router → Incus →
"Feature not supported: Incus substrate" with no hint.

- `cmd/allternit-api/src/bot_desktop_templates.rs`: default os chosen by
  configured substrates — Tart-only host (TART_HOST_URL/_URLS set, no
  INCUS_URL/_URLS) defaults to `macos`. Pure `pick_default_os(incus, tart)` +
  env-reading wrapper, unit-tested.
- `bot_desktop_routes.rs` spawn error path: `DriverError::NotSupported` gets an
  explicit hint to pass `?os=…&provider=…` or configure the substrate.

## Bug 7 — provision params query-only, JSON body silently ignored

`cmd/allternit-api/src/bot_desktop_routes.rs`: `provision_desktop` now also
accepts `Option<Json<ProvisionDesktopBody>>`; body fields fill gaps, explicit
query params win. Validation errors (e.g. bad resolution) therefore fire for
body callers instead of being ignored.

## Bug 8 — `sandbox_id` required on all desktop routes

`DesktopQuery.sandbox_id` becomes `Option<String>`; new
`resolve_sandbox_id` falls back to the bot's persisted sandbox record and only
4xxs when neither exists. Applied to status, screenshot, start, stop, destroy,
observe, take-over, hand-back (pause/resume forward unchanged).

## Verification

- `cargo test -p allternit-api bot_desktop` (existing + new tests)
- `cargo build -p allternit-api --release` (AGENTS.md #4: production config compiles)
- `node scripts/release-preflight.mjs` (release gate)
- Live probe on isolated :18013 with TART env: bare `POST .../provision` no
  longer Incus-errors; JSON-body provision parses; bare `GET .../desktop`
  resolves the persisted sandbox.

## Land

Commit → push → PR → merge → ledger attestation + LEDGER.md → cleanup.
Desktop rebuild deferred to owner ("after all is done").
