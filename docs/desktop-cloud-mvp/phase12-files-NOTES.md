# Phase 12 — Bot desktop file upload / download endpoints

## Goal
Allow agents and operators to move files in and out of a running bot desktop.
This completes the core Linux-MVP remote-control surface (screenshot, input,
shell, files) before moving on to fleet-wide platform work.

## What changed
- `platform/contracts/driver-interface/src/lib.rs`
  - Added `pull_file` and `push_file` default methods to `ExecutionDriver`.
  - Defaults return `NotSupported` so drivers opt-in.

- `cmd/allternit-computer-cloud/src/substrate.rs`
  - Extended `HttpClient` with `request_bytes_with_body` for raw byte uploads.
  - Implemented the new method for `ReqwestClient` and the test `MockClient`.
  - Added `IncusSubstrate::push_file` using the Incus files API.
  - Added regression test `exec_extracts_output_from_nested_metadata` (carried
    forward from Phase 9).

- `cmd/allternit-computer-cloud/src/driver.rs`
  - Implemented `pull_file` and `push_file` on `IncusDriver` by delegating to
    the substrate.

- `cmd/allternit-api/src/bot_desktop_input.rs`
  - Added `GET /api/v1/bots/:bot_id/desktop/files/download?path=...`.
  - Added `POST /api/v1/bots/:bot_id/desktop/files/upload?path=...`.
  - Upload accepts a raw byte body; download returns
    `application/octet-stream`.
  - Extended the test mock to support file operations and added unit tests.

- `cmd/allternit-api/src/bot_desktop_routes.rs`
  - Wired the two file routes into `bot_desktop_router()`.

## Endpoints added
- `GET /api/v1/bots/:bot_id/desktop/files/download?sandbox_id=<id>&path=<guest-path>`
- `POST /api/v1/bots/:bot_id/desktop/files/upload?sandbox_id=<id>&path=<guest-path>`

## Proof artifact
- Screen recording: `docs/desktop-cloud-mvp/phase12-files-proof.webm`
  - Uploads `/tmp/allternit-upload.txt` with content `hello from allternit upload`.
  - Downloads the same file and prints its contents.
  - Verifies the file via the shell endpoint.
  - Shows HTTP 503 when downloading a non-existent file.

## Manual verification
```bash
BOT_ID=b2d190b0-f013-495f-b8ba-e29d70ad334f
SANDBOX_ID=allternit-bot-b2d190b0-f013-4-d7d7e449d6e54ee9987938661da5689b

printf 'hello from allternit upload' | curl -s -X POST \
  -H 'Host: 127.0.0.1:8013' \
  -H 'Content-Type: application/octet-stream' \
  "http://127.0.0.1:8013/api/v1/bots/$BOT_ID/desktop/files/upload?sandbox_id=$SANDBOX_ID&path=/tmp/allternit-upload.txt" \
  --data-binary @-

curl -s -H 'Host: 127.0.0.1:8013' \
  "http://127.0.0.1:8013/api/v1/bots/$BOT_ID/desktop/files/download?sandbox_id=$SANDBOX_ID&path=/tmp/allternit-upload.txt"
```

## Test results
```
cargo test -p allternit-api bot_desktop_input
...
test bot_desktop_input::tests::download_endpoint_returns_file_bytes ... ok
test bot_desktop_input::tests::upload_endpoint_stores_file_bytes ... ok

test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 440 filtered out
```

```
cargo test -p allternit-api bot_desktop
...
test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 426 filtered out
```

```
cargo test -p allternit-computer-cloud
...
test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

## Files changed
- `platform/contracts/driver-interface/src/lib.rs`
- `cmd/allternit-computer-cloud/src/substrate.rs`
- `cmd/allternit-computer-cloud/src/driver.rs`
- `cmd/allternit-api/src/bot_desktop_input.rs`
- `cmd/allternit-api/src/bot_desktop_routes.rs`

## Constraint check
- `bot_desktop_input.rs`: 870 LOC.
- `bot_desktop_routes.rs`: 1,344 LOC.
- `substrate.rs`: 871 LOC.
- `driver.rs`: 511 LOC.
- `platform/contracts/driver-interface/src/lib.rs`: 993 LOC.
- All under 1,500 LOC.
- No Orgo dependency introduced.
- Proof artifact is a screen recording.

## Next
- Phase 13: standardize the guest agent runtime (`allternit-mux`) for Linux.
  This will eventually replace ad-hoc `scrot`/`xdotool`/shell calls with a
  stable agent protocol.
