# Phase 19 — macOS Tart wrapper and base image

## Goal
Add an Apple-Silicon Tart substrate to the heterogeneous Allternit desktop cloud so macOS desktops can be provisioned through the same unified control-plane API used for Incus Linux/Windows desktops.

## What changed

### New code (all under `cmd/allternit-computer-cloud/`)
- `src/bin/tart-host.rs` — small HTTP wrapper around the Tart CLI.
  - Endpoints: `POST /v1/vms/:name/create`, `POST .../start`, `POST .../stop`, `DELETE ...`, `POST .../exec`, `POST .../files/pull`, `POST .../files/push`, `GET .../screenshot`, `GET /health`.
  - Fixes applied during this phase:
    - Removed the `--` separator from `tart exec` invocations (Tart treats it as part of the command on Linux guests).
    - Added an SSH fallback using `sshpass` for guests that do not have the Tart Guest Agent running.
    - `DELETE` now stops the VM before deleting it because Tart refuses to delete a running instance.
  - Keeps the host wrapper stateless; the Tart CLI remains the source of truth.
- `src/tart.rs` — `TartDriver` implementing the shared `ExecutionDriver` trait.
  - Translates `SpawnSpec` into `tart clone` + `tart set` calls via the wrapper.
  - Exposes desktop endpoint as VNC over the configured `TART_VNC_HOST`.
  - Implements `pull_file` / `push_file` using the wrapper's exec/file endpoints.
- `Cargo.toml` — added `tracing-subscriber` and `base64` for the wrapper binary.

### API wiring (already present, now active)
- `cmd/allternit-api/src/main.rs` selects `TartDriver` on macOS when `TART_HOST_URL` and/or `TART_BIN` are set.
- The same `/api/v1/bots/:bot_id/desktop/*` routes now route to Tart when the API is started with the Tart environment.

### Base image
- Cloned `ghcr.io/cirruslabs/ubuntu:latest` locally as `tart-ubuntu-test` (a lightweight, fast-to-clone image for proving the wiring).
- Set `BOT_DESKTOP_IMAGE=tart-ubuntu-test` so provisioning targets this image.
- Tart itself is installed at `/opt/homebrew/bin/tart` on the Apple Silicon host.

## How to run

```bash
# 1. Start the Tart host wrapper (on the Mac).
TART_BIN=/opt/homebrew/bin/tart TART_HOST_BIND=127.0.0.1:8020 \
  cargo run -p allternit-computer-cloud --bin tart-host

# 2. Start the API with the Tart driver.
ALLTERNIT_LOCAL_DEV_BYPASS=true \
ALLTERNIT_SELF_HOSTED=true \
ALLTERNIT_API_PORT=8013 \
TART_HOST_URL=http://127.0.0.1:8020 \
TART_BIN=/opt/homebrew/bin/tart \
TART_VNC_HOST=127.0.0.1 \
BOT_DESKTOP_IMAGE=tart-ubuntu-test \
  cargo run -p allternit-api --bin allternit-api

# 3. Provision a desktop.
curl -s -X POST \
  "http://127.0.0.1:8013/api/v1/bots/<BOT_ID>/desktop/provision?os=macos" \
  -H 'Content-Type: application/json'

# 4. Use the sandbox_id from the response for status / shell / files / deprovision.
```

## End-to-end proof
- Screen recording: `docs/desktop-cloud-mvp/phase19-tart-demo.webm`
- The recording shows:
  1. The Tart image list before provisioning.
  2. A live `POST /api/v1/bots/:bot_id/desktop/provision?os=macos` call returning a Tart sandbox.
  3. Polling the status endpoint until the VM is `running`.
  4. Running `uname -a` inside the VM through the API shell endpoint (SSH fallback).
  5. Uploading a file to `/tmp/allternit-demo.txt` and downloading it back.
  6. Deprovisioning the desktop and confirming the VM is removed from `tart list`.

## Tests
```bash
cargo test -p allternit-computer-cloud   # 18 passed
cargo test -p allternit-api bot_desktop  # 30 passed
```

## Size check
- `cmd/allternit-computer-cloud/src/tart.rs`: ~350 LOC.
- `cmd/allternit-computer-cloud/src/bin/tart-host.rs`: ~390 LOC.
- Both well under the 1,500 LOC limit.

## Notes / caveats
- The demo uses a Cirrus Labs Ubuntu image because a full macOS Sonoma image is large and slow to download. The wiring is identical for macOS; changing `BOT_DESKTOP_IMAGE` to a macOS Tart image is the only difference.
- Linux guests without the Tart Guest Agent rely on the SSH fallback (`sshpass`, default user `admin` / password `admin`). macOS guests with the Tart Guest Agent will use native `tart exec`.
- Windows Phase 18 remains code-ready but blocked on the VPS lacking nested KVM; Tart gives us the Apple Silicon path without needing KVM.
