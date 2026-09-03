# Phase 11 — Bot desktop shell endpoint

## Goal
Allow agents and operators to run arbitrary commands inside a bot desktop and
receive the exit code, stdout, stderr, and duration. This is the third guest-
control primitive after screenshot and input.

## What changed
- `cmd/allternit-api/src/bot_desktop_input.rs`
  - Added `POST /api/v1/bots/:bot_id/desktop/shell?sandbox_id=...`.
  - Body: `{ "command": ["echo", "hello"], "env": {"FOO": "bar"}, "timeout": 30 }`
  - Response: `{ "exit_code": 0, "stdout": "...", "stderr": "...", "duration_ms": 123 }`
  - Returns HTTP 400 for an empty command.
  - Merges the caller's `env` map with `DISPLAY=:0`.
  - Added unit test `shell_endpoint_returns_command_output`.

- `cmd/allternit-api/src/bot_desktop_routes.rs`
  - Wired `run_desktop_shell` into `bot_desktop_router()`.

## Endpoints added
- `POST /api/v1/bots/:bot_id/desktop/shell?sandbox_id=<sandbox_id>`
  - Runs the provided command array inside the guest via
    `ExecutionDriver::exec`.
  - Returns the full `ExecResult` fields as JSON.

## Proof artifact
- Screen recording: `docs/desktop-cloud-mvp/phase11-shell-proof.webm`
  - Runs `echo "hello from shell"` and shows stdout in the response.
  - Runs `env` with an extra `FOO=bar` environment variable.
  - Runs `false` and shows `exit_code: 1`.
  - Shows HTTP 400 for an empty command array.

## Manual verification
```bash
BOT_ID=b2d190b0-f013-495f-b8ba-e29d70ad334f
SANDBOX_ID=allternit-bot-b2d190b0-f013-4-d7d7e449d6e54ee9987938661da5689b

curl -s -X POST -H 'Host: 127.0.0.1:8013' -H 'Content-Type: application/json' \
  "http://127.0.0.1:8013/api/v1/bots/$BOT_ID/desktop/shell?sandbox_id=$SANDBOX_ID" \
  -d '{"command":["echo","hello from shell"]}'
```

## Test results
```
cargo test -p allternit-api bot_desktop_input
...
test bot_desktop_input::tests::shell_endpoint_returns_command_output ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 440 filtered out
```

```
cargo test -p allternit-api bot_desktop
...
test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 426 filtered out
```

## Files changed
- `cmd/allternit-api/src/bot_desktop_input.rs` — shell endpoint + test.
- `cmd/allternit-api/src/bot_desktop_routes.rs` — wired route.

## Constraint check
- `bot_desktop_input.rs`: 666 LOC.
- `bot_desktop_routes.rs`: 1,336 LOC.
- No Orgo dependency introduced.
- Proof artifact is a screen recording.

## Next
- Phase 12: file upload/download endpoints for bot desktop (Incus files API
  via the substrate, or via `ExecutionDriver` with a new file-transfer trait).
