# Phase 17 — Production auth + audit logging for desktop operations

## Goal
Remove reliance on the local-dev auth bypass for the bot-desktop control plane,
enforce the same Clerk JWT / enterprise-token / desktop-bootstrap auth paths as
the rest of the API, and record every desktop operation to an immutable audit
log.

## What changed
- Added `cmd/allternit-api/migrations/V93__desktop_audit_log.sql`:
  - New `desktop_audit_logs` table with indexes on `bot_id`, `user_id`, and
    `created_at`.
- Added `cmd/allternit-api/src/bot_desktop_audit.rs` (under 1,000 LOC):
  - `desktop_audit_middleware` extracts `bot_id` from the request path, the
    authenticated `AuthUser`, method/path, response success/failure, and writes
    a row to `desktop_audit_logs` asynchronously.
  - `GET /api/v1/bots/:bot_id/desktop/audit-logs` lists the most recent audit
    entries for a bot, gated by `verify_bot_ownership`.
  - Unit tests cover bot-id extraction and action classification.
- Wired the middleware around `bot_desktop_router()` in
  `cmd/allternit-api/src/main.rs` so every existing and future desktop endpoint
  is audited automatically.
- Production-auth posture is already supported by the shared
  `auth_middleware`:
  - `ALLTERNIT_LOCAL_DEV_BYPASS=1` (used only by `./dev/scripts/start-api.sh`)
    accepts loopback-origin requests as the default local user.
  - Without that env, the same middleware requires a valid Clerk JWT, enterprise
    bearer token, or `x-allternit-desktop-access-token` header trust.

## Test results
```
cargo test -p allternit-api bot_desktop
  28 passed; 0 failed

cargo test -p allternit-computer-cloud
  18 passed; 0 failed
```

## End-to-end proof
Screen recording: `phase17-auth-audit-proof.webm`.
Demonstrates:
1. `GET /api/v1/bots/:bot_id/desktop/snapshots` from `127.0.0.1` succeeds while
   dev bypass is enabled.
2. The same request with a non-localhost `Host`/`Origin` and no token returns
   HTTP 401, proving the production auth gate is active when the bypass is not
   in play.
3. `GET /api/v1/bots/:bot_id/desktop/audit-logs` returns the recorded entry for
   the successful snapshot list, including method, path, action, user id, and
   success flag.

## Known limitations / next steps
- Audit entries currently store only the HTTP status for failures; a future pass
  can add a short reason code from downstream drivers.
- Phase 18 adds Windows Incus image and guest-agent support.
