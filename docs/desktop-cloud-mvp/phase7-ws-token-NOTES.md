# Phase 7 — Signed WebSocket tokens for bot desktop VNC

## Goal
Remove the `user_id` query parameter from the public bot-desktop VNC WebSocket
URL and replace it with a short-lived HMAC-SHA256 signed token so the URL is
not usable if leaked or replayed.

## What changed
- `cmd/allternit-api/src/bot_desktop_stream.rs`
  - Added `DesktopTokenClaims`, `sign_desktop_token`, and `verify_desktop_token`
    using HMAC-SHA256 / URL-safe base64.
  - WebSocket handler now reads `?sandbox_id=...&token=...`, verifies signature,
    expiration, and that claims match the path bot id / authenticated user.
  - Dev fallback secret derives from `ALLTERNIT_DESKTOP_WS_SECRET` or, only in
    local bypass mode, a deterministic secret based on `data_dir`.
- `cmd/allternit-api/src/bot_desktop_routes.rs`
  - `build_ws_url` now signs a 5-minute token and emits `?token=...` instead of
    `?user_id=...`.

## Endpoints affected
- `GET /api/v1/bots/:bot_id/desktop` — `ws_url` now contains a signed token.
- `GET /ws/bots/:bot_id/desktop/vnc` — requires `?token=` and rejects
  missing/expired/tampered tokens with HTTP 403 before upgrading.

## Proof artifact
- Screen recording: `docs/desktop-cloud-mvp/phase7-ws-token-proof.webm`
  - Calls status and shows `ws_url` includes `token=...`.
  - Opens a WebSocket with the valid token and connects.
  - Shows the server log line `Opening VNC WebSocket proxy ...`.
  - Opens a WebSocket with a tampered token and gets HTTP 403.

## Manual verification
```bash
# 1. Create a bot (or reuse an existing one) and note the id.
curl -s -H 'Host: 127.0.0.1:8013' -H 'Content-Type: application/json' \
  -d '{"name":"token-demo","description":"demo for signed ws tokens","type":"worker","model":"gpt-4o-mini","provider":"openai","trust_tier":"standard","harness_config":{"mode":"local"},"enabled_modes":["chat"]}' \
  http://127.0.0.1:8013/api/v1/agents

# 2. Provision a desktop.
curl -s -H 'Host: 127.0.0.1:8013' -X POST \
  http://127.0.0.1:8013/api/v1/bots/<BOT_ID>/desktop/provision

# 3. Take over so human control is allowed.
curl -s -H 'Host: 127.0.0.1:8013' -X POST \
  "http://127.0.0.1:8013/api/v1/bots/<BOT_ID>/desktop/take-over?sandbox_id=<SANDBOX>"

# 4. Read status and copy ws_url (relative; prepend ws://127.0.0.1:8013).
curl -s -H 'Host: 127.0.0.1:8013' \
  "http://127.0.0.1:8013/api/v1/bots/<BOT_ID>/desktop?sandbox_id=<SANDBOX>"

# 5. Connect with the valid token.
python3 - <<'PY'
import asyncio, websockets
url='ws://127.0.0.1:8013<WS_URL_FROM_STEP_4>'
async def main():
    async with websockets.connect(url, additional_headers={'Host':'127.0.0.1:8013'}) as ws:
        print('connected', ws.remote_address)
        await ws.close()
asyncio.run(main())
PY
```

## Test results
```
cargo test -p allternit-api bot_desktop
running 11 tests
...
test bot_desktop_stream::tests::sign_and_verify_valid_token ... ok
test bot_desktop_stream::tests::verify_rejects_expired_token ... ok
test bot_desktop_stream::tests::verify_rejects_tampered_payload ... ok
test bot_desktop_stream::tests::verify_rejects_wrong_secret ... ok
test bot_desktop_stream::tests::verify_rejects_malformed_token ... ok
...
test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 426 filtered out
```

## Files changed
- `cmd/allternit-api/src/bot_desktop_stream.rs` — token signing/verification,
  handler param change, unit tests.
- `cmd/allternit-api/src/bot_desktop_routes.rs` — `build_ws_url` signs token.

## Constraint check
- `bot_desktop_stream.rs` is ~449 LOC.
- `bot_desktop_routes.rs` is ~1,174 LOC.
- No Orgo dependency introduced.
- Proof artifact is a screen recording.

## Next
- Phase 8: rate limiting on bot desktop endpoints.
