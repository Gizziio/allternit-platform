# Phase 9 — Bot desktop screenshot endpoint

## Goal
Allow the platform (and human operators) to capture the current frame of a
running bot desktop through the API. This is the first guest-control primitive
beyond VNC streaming and is required for task observability, human-in-the-loop
review, and agent telemetry.

## What changed
- `cmd/allternit-api/src/bot_desktop_routes.rs`
  - Added `GET /api/v1/bots/:bot_id/desktop/screenshot?sandbox_id=...`.
  - Verifies bot ownership, builds an `ExecutionHandle` from the sandbox id,
    runs `scrot` inside the guest with `DISPLAY=:0`, base64-decodes the output,
    and returns `image/png`.
  - Returns HTTP 503 with diagnostics (`exit_code`, `stderr`) when the guest
    command fails or produces no output.
  - Added unit test `screenshot_endpoint_returns_png_from_driver_exec`.

- `cmd/allternit-computer-cloud/src/substrate.rs`
  - Fixed `IncusSubstrate::exec` output extraction. Incus wraps the completed
    exec operation in two levels of `metadata`; the code was looking at the
    outer level and missing the `output` and `return` fields.
  - Now unwraps both levels with `response_payload` before reading `output.1`,
    `output.2`, and `return`.
  - Added request/response logging for exec output fetches.
  - Added unit test `exec_extracts_output_from_nested_metadata` to prevent
    regression.

## Endpoints added
- `GET /api/v1/bots/:bot_id/desktop/screenshot?sandbox_id=<sandbox_id>`
  - Response: `image/png` body on success.
  - Errors: HTTP 403 (ownership), 503 (driver/config/guest failure).

## Proof artifact
- Screen recording: `docs/desktop-cloud-mvp/phase9-screenshot-proof.webm`
  - Calls the screenshot endpoint against the running Incus desktop.
  - Shows HTTP 200 and a valid PNG response (1280x720, ~480 KB).
  - Inspects the response file type with `file` and `xxd`.

## Manual verification
```bash
BOT_ID=b2d190b0-f013-495f-b8ba-e29d70ad334f
SANDBOX_ID=allternit-bot-b2d190b0-f013-4-d7d7e449d6e54ee9987938661da5689b
curl -s -H 'Host: 127.0.0.1:8013' \
  "http://127.0.0.1:8013/api/v1/bots/$BOT_ID/desktop/screenshot?sandbox_id=$SANDBOX_ID" \
  -o /tmp/screen.png
file /tmp/screen.png
```

## Test results
```
cargo test -p allternit-computer-cloud
...
test substrate::tests::exec_extracts_output_from_nested_metadata ... ok
test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

```
cargo test -p allternit-api bot_desktop
...
test bot_desktop_routes::tests::screenshot_endpoint_returns_png_from_driver_exec ... ok
test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 426 filtered out
```

## Files changed
- `cmd/allternit-api/src/bot_desktop_routes.rs` — screenshot endpoint + test.
- `cmd/allternit-computer-cloud/src/substrate.rs` — exec output fix + test.

## Constraint check
- `substrate.rs` is ~800 LOC (well under 1,500).
- `bot_desktop_routes.rs` remains ~1,324 LOC (under 1,500).
- No Orgo dependency introduced.
- Proof artifact is a screen recording.

## Next
- Phase 10: mouse/keyboard input endpoints (`xdotool` via `ExecutionDriver::exec`).
