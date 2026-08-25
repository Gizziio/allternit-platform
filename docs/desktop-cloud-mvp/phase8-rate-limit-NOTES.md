# Phase 8 — Per-user rate limiting on bot desktop endpoints

## Goal
Protect the bot desktop REST surface from accidental abuse and from being used
to exhaust the general API budget. Desktop operations are heavier than typical
API calls, so they get their own per-user sliding-window limit.

## What changed
- `cmd/allternit-api/src/rate_limit.rs`
  - Added `DEFAULT_BOT_DESKTOP_RATE_LIMIT_RPM` (30 requests / minute / user).
  - Added a separate `BOT_DESKTOP_RATE_LIMIT_WINDOWS` sliding window keyed by
    authenticated `user_id`.
  - Added `bot_desktop_rate_limit_middleware`, which returns HTTP 429 with a
    `Retry-After` header when the window is exhausted.
  - Added unit tests that verify the default allowance, blocking, and per-user
    isolation.
- `cmd/allternit-api/src/bot_desktop_routes.rs`
  - Applied the desktop rate-limit middleware to every route returned by
    `bot_desktop_router()`.

## Endpoints affected
All bot desktop REST endpoints:
- `GET /api/v1/bots/:bot_id/desktop`
- `POST /api/v1/bots/:bot_id/desktop/provision`
- `POST /api/v1/bots/:bot_id/desktop/start`
- `POST /api/v1/bots/:bot_id/desktop/stop`
- `POST /api/v1/bots/:bot_id/desktop/deprovision`
- `POST /api/v1/bots/:bot_id/desktop/observe`
- `POST /api/v1/bots/:bot_id/desktop/take-over`
- `POST /api/v1/bots/:bot_id/desktop/hand-back`

The VNC WebSocket endpoint (`/ws/bots/:bot_id/desktop/vnc`) is intentionally
not covered by this middleware; it is protected by the signed token and the
public per-organization rate limiter.

## Proof artifact
- Screen recording: `docs/desktop-cloud-mvp/phase8-rate-limit-proof.webm`
  - Fires 32 rapid `GET /api/v1/bots/:bot_id/desktop` requests as the same
    local dev user.
  - Shows requests 1–30 returning HTTP 200.
  - Shows requests 31+ returning HTTP 429 with `Retry-After`.

## Manual verification
```bash
BOT_ID=<your-bot-id>
SANDBOX_ID=<your-sandbox-id>
for i in {1..32}; do
  code=$(curl -s -o /dev/null -w '%{http_code}' \
    -H 'Host: 127.0.0.1:8013' \
    "http://127.0.0.1:8013/api/v1/bots/$BOT_ID/desktop?sandbox_id=$SANDBOX_ID")
  echo "$i: $code"
done
```

## Test results
```
cargo test -p allternit-api rate_limit
...
test rate_limit::tests::bot_desktop_rate_limit_allows_default_then_blocks ... ok
test rate_limit::tests::bot_desktop_rate_limit_is_per_user ... ok
...
test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 431 filtered out
```

```
cargo test -p allternit-api bot_desktop
running 13 tests
...
test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 426 filtered out
```

## Files changed
- `cmd/allternit-api/src/rate_limit.rs` — desktop rate-limit constants,
  middleware, helpers, and unit tests.
- `cmd/allternit-api/src/bot_desktop_routes.rs` — layered middleware onto the
  desktop router.

## Constraint check
- `rate_limit.rs` is ~480 LOC.
- `bot_desktop_routes.rs` is ~1,177 LOC.
- No Orgo dependency introduced.
- Proof artifact is a screen recording.

## Next
- Decide whether to extend the same per-user rate limiter to the WebSocket
  handshake or to keep it token-only.
