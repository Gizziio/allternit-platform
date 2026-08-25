# Phase 10 — Bot desktop mouse + keyboard input endpoints

## Goal
Allow AI agents and human operators to send mouse and keyboard input to a
running bot desktop through the API. This completes the basic remote-control
primitives (screenshot + input) needed for agent loops and human takeover.

## What changed
- `cmd/allternit-api/src/bot_desktop_input.rs` (new module, 543 LOC)
  - Added `POST /api/v1/bots/:bot_id/desktop/mouse?sandbox_id=...`.
  - Added `POST /api/v1/bots/:bot_id/desktop/keyboard?sandbox_id=...`.
  - Both endpoints verify bot ownership, validate the request body, build an
    `xdotool` command, run it inside the guest via `ExecutionDriver::exec`,
    and return `{ "success": true }` on success.
  - Mouse actions: `move`, `click`, `rightclick`, `doubleclick`, `mousedown`,
    `mouseup`.
  - Keyboard actions: `type` and `key`.
  - Added unit tests for the endpoints and command builders.

- `cmd/allternit-api/src/bot_desktop_routes.rs`
  - Wired the new input handlers into `bot_desktop_router()`.
  - Made `verify_bot_ownership`, `build_handle`, and `DesktopQuery` accessible
    to the new module.
  - File is now 1,332 LOC, staying under the 1,500 LOC feature limit.

- `cmd/allternit-computer-cloud/guest/cloud-init.yaml`
  - Added `xdotool` to the package list so future desktop images ship with the
    input tool pre-installed.

## Endpoints added
- `POST /api/v1/bots/:bot_id/desktop/mouse?sandbox_id=<sandbox_id>`
  - Body: `{ "action": "click", "x": 500, "y": 300, "button": "left" }`
  - Response: `{ "success": true }` or error details.

- `POST /api/v1/bots/:bot_id/desktop/keyboard?sandbox_id=<sandbox_id>`
  - Body: `{ "action": "type", "text": "hello" }`
  - Response: `{ "success": true }` or error details.

## Proof artifact
- Screen recording: `docs/desktop-cloud-mvp/phase10-input-proof.webm`
  - Sends mouse move, mouse click, keyboard type, and keyboard key (Return).
  - Shows HTTP 200 + `{ "success": true }` for each command.
  - Shows HTTP 400 for an unsupported mouse action (`hover`).

## Manual verification
```bash
BOT_ID=b2d190b0-f013-495f-b8ba-e29d70ad334f
SANDBOX_ID=allternit-bot-b2d190b0-f013-4-d7d7e449d6e54ee9987938661da5689b

curl -s -X POST -H 'Host: 127.0.0.1:8013' -H 'Content-Type: application/json' \
  "http://127.0.0.1:8013/api/v1/bots/$BOT_ID/desktop/mouse?sandbox_id=$SANDBOX_ID" \
  -d '{"action":"move","x":500,"y":300}'

curl -s -X POST -H 'Host: 127.0.0.1:8013' -H 'Content-Type: application/json' \
  "http://127.0.0.1:8013/api/v1/bots/$BOT_ID/desktop/keyboard?sandbox_id=$SANDBOX_ID" \
  -d '{"action":"type","text":"hello from allternit"}'
```

## Test results
```
cargo test -p allternit-api bot_desktop_input
...
test bot_desktop_input::tests::mouse_endpoint_sends_xdotool_click ... ok
test bot_desktop_input::tests::keyboard_endpoint_sends_xdotool_type ... ok
test bot_desktop_input::tests::mouse_command_builder_rejects_unknown_action ... ok
test bot_desktop_input::tests::keyboard_command_builder_rejects_missing_text ... ok

test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 440 filtered out
```

```
cargo test -p allternit-api bot_desktop
...
test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 426 filtered out
```

## Files changed
- `cmd/allternit-api/src/bot_desktop_input.rs` — new input endpoints + tests.
- `cmd/allternit-api/src/bot_desktop_routes.rs` — wired routes, exported helpers.
- `cmd/allternit-computer-cloud/guest/cloud-init.yaml` — added `xdotool`.

## Constraint check
- `bot_desktop_routes.rs`: 1,332 LOC.
- `bot_desktop_input.rs`: 543 LOC.
- No Orgo dependency introduced.
- Proof artifact is a screen recording.

## Next
- Phase 11: shell endpoint for bot desktop (run arbitrary commands and stream
  or return output).
