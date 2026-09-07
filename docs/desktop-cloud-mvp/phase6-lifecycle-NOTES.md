# Phase 6 — Bot desktop lifecycle control (stop / start / deprovision)

## Goal
Close the resource-leak gap in the Desktop-as-a-Service MVP by adding the missing
lifecycle endpoints so a bot desktop can be stopped, restarted, and torn down
through the Allternit API.

## Endpoints added
- `POST /api/v1/bots/:bot_id/desktop/start` — resume a stopped sandbox.
- `POST /api/v1/bots/:bot_id/desktop/stop` — pause a running sandbox.
- `POST /api/v1/bots/:bot_id/desktop/deprovision` — destroy the sandbox and
  remove the persistent bot↔sandbox mapping.

All three endpoints verify bot ownership, read the persisted sandbox id from
SQLite, and update the `bot_desktop_sandboxes.status` column so state survives
API restarts.

## Proof artifact
- Screen recording: `docs/desktop-cloud-mvp/phase6-lifecycle-proof.webm`
  - Provisions a desktop for `lifecycle-demo-bot`.
  - Waits for the API to report `running`, then shows the Incus instance as
    `RUNNING` on the VPS.
  - Calls `stop` and shows the Incus instance as `STOPPED`.
  - Calls `start` and shows the Incus instance as `RUNNING` again.
  - Calls `deprovision` and shows the instance removed from Incus.

## Key fixes
1. **Instance name length**: The Incus driver generated
   `allternit-bot-{bot_id}-{uuid}`. Long bot ids (e.g. `lifecycle-demo-bot`)
   pushed the name past Incus's 63-character limit and provisioning failed with
   HTTP 400. Fixed by truncating the bot id suffix to 15 characters; the UUID
   still keeps names unique.
2. **Status endpoint URL**: The existing route is
   `GET /api/v1/bots/:bot_id/desktop?sandbox_id=...` (no `/status` suffix).
3. **Handle reconstruction**: The API persists only the driver's native sandbox
   id, but `ExecutionDriver::pause_vm`, `resume_vm`, and `destroy` take an
   `ExecutionHandle`. Added `build_handle()` to reconstruct a minimal handle
   carrying just `native_id`; the Incus driver implementations only use that
   field.

## Run command (manual verification)
```bash
# 1. Provision
BOT=manual-test-bot
curl -s -X POST "http://127.0.0.1:8013/api/v1/bots/$BOT/desktop/provision" \
  -H "Content-Type: application/json" -d '{}'

# 2. Read status (use sandbox_id returned above)
curl -s "http://127.0.0.1:8013/api/v1/bots/$BOT/desktop?sandbox_id=<SANDBOX_ID>"

# 3. Stop
curl -s -X POST "http://127.0.0.1:8013/api/v1/bots/$BOT/desktop/stop"

# 4. Start
curl -s -X POST "http://127.0.0.1:8013/api/v1/bots/$BOT/desktop/start"

# 5. Deprovision
curl -s -X POST "http://127.0.0.1:8013/api/v1/bots/$BOT/desktop/deprovision"
```

## Test results
```
cargo test -p allternit-api bot_desktop
running 5 tests
test bot_desktop_routes::tests::lifecycle_endpoints_forbid_non_owner ... ok
test bot_desktop_routes::tests::start_desktop_calls_resume_vm_and_updates_status ... ok
test bot_desktop_routes::tests::stop_desktop_calls_pause_vm_and_updates_status ... ok
test bot_desktop_routes::tests::deprovision_desktop_calls_destroy_and_deletes_record ... ok
test bot_desktop_routes::tests::lifecycle_endpoints_return_404_when_no_sandbox ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 426 filtered out
```

```
cargo test -p allternit-computer-cloud
running 12 tests
...
test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

## Files changed
- `cmd/allternit-api/src/bot_desktop_routes.rs` — added start/stop/deprovision
  handlers, persistence helpers, and mock-driver unit tests.
- `cmd/allternit-api/src/lib.rs` — added `test_helpers::app_state_with_driver`
  so tests can inject a mock `ExecutionDriver`.
- `cmd/allternit-computer-cloud/src/driver.rs` — truncate bot id in Incus
  instance names to stay within the 63-character limit.

## Constraint check
- `bot_desktop_routes.rs` remains under 1,500 LOC.
- No Orgo dependency introduced.
- Proof artifact is a screen recording.

## Next
- Phase 7: signed WebSocket tokens for the VNC proxy.
