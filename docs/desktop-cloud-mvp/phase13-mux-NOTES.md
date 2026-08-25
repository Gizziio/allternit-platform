# Phase 13 — Standardize guest agent runtime (`allternit-mux`) for Linux

## Goal
Provide a single, reusable guest-side agent inside every Linux Incus desktop so the API can create persistent terminal sessions, send commands, and read their output through one abstraction instead of one-off `exec` calls.

## What changed
- Added `allternit-mux` Rust crate under the workspace.
  - Built a tiny tmux-like IPC daemon that exposes JSON over stdin/stdout.
  - Commands: `new-session`, `new-pane`, `send-keys`, `capture-pane`.
- Guest integration
  - Added `allternit-mux.service` to `cmd/allternit-computer-cloud/guest/cloud-init.yaml` with a `ConditionPathExists=/opt/allternit-mux/allternit-mux` guard so it only starts after the binary is placed.
  - CI pipeline (Phase 15) will place the binary at `/opt/allternit-mux/allternit-mux`.
- API integration
  - New module: `cmd/allternit-api/src/bot_desktop_mux.rs` (434 LOC).
  - New endpoint: `POST /api/v1/bots/:bot_id/desktop/mux/run`.
  - Body: `{ "command": "echo hello", "session_id": "optional", "pane_id": "optional" }`.
  - Returns: `{ "session_id": "...", "pane_id": "...", "output": "..." }`.
  - The handler creates/uses an allternit-mux session and pane inside the guest, sends the command, waits for output, and captures the pane.
- Kept `bot_desktop_routes.rs` under 1,500 LOC by isolating mux logic in its own module.

## Test results
```
cargo test -p allternit-api bot_desktop
  23 passed; 0 failed
cargo test -p allternit-computer-cloud
  13 passed; 0 failed
```

## End-to-end proof
Screen recording: `phase13-mux-proof.webm` (212 seconds).
Demonstrates:
1. `allternit-mux` binary already running inside the provisioned Incus desktop.
2. Calling `POST /api/v1/bots/:bot_id/desktop/mux/run` with `{"command":"echo hello"}`.
3. Response contains a `session_id`, `pane_id`, and `output` with `hello`.
4. Re-running with the same `session_id`/`pane_id` appends output.

## Known limitations / next steps
- Windows/macOS guests will need their own agent runtimes (Phase 18/19).
- No automatic binary delivery yet; the binary was manually placed for this proof. Phase 15 adds the CI image pipeline.
- Pane output polling is simple sleep-loop; can be improved with a streaming endpoint later.
