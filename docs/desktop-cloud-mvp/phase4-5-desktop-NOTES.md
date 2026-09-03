# Phase 4 + 5 — ACU-driven cloud desktop + human view/control via web UI

## Goal
Complete the Desktop-as-a-Service loop:
1. **Phase 4:** A bot can request a cloud Ubuntu/XFCE desktop and the ACU gateway can
   drive a browser inside it over remote CDP.
2. **Phase 5:** A human can open the Allternit web UI, view the same desktop through
   VNC, and interact with it in real time.

Both slices are demonstrated in a single screen recording so the end-to-end flow is
observable in one place.

## Proof artifact
- Screen recording: `docs/desktop-cloud-mvp/phase4-5-desktop-proof.webm`
  - Shows the noVNC viewer loading the bot desktop from the Allternit web UI.
  - Then shows Chrome launching inside the desktop and navigating to
    `https://example.com/` driven by the ACU gateway over remote CDP.
  - File size: ~1.7 MB.

## Phase 4 — ACU browser task

### Run command
```bash
cd /Users/joe/Desktop/allternit-workspace/allternit-session-desktop-cloud-mvp
mkdir -p docs/desktop-cloud-mvp
INCUS_URL=https://mail:8443 \
INCUS_VNC_HOST=mail \
INCUS_CDP_HOST=100.108.37.126 \
INCUS_CLIENT_CERT=/Users/joe/.config/allternit/incus/client.crt \
INCUS_CLIENT_KEY=/Users/joe/.config/allternit/incus/client.key \
INCUS_INSECURE_SKIP_VERIFY=true \
ACU_URL=http://localhost:8760 \
ACU_PROOF_PATH=docs/desktop-cloud-mvp/phase4-acu-proof.png \
cargo run -p allternit-computer-cloud --example acu_browser_task
```

The example provisions the desktop, starts Chrome, navigates to example.com, extracts
the title, and saves a screenshot.

### Key fixes
1. **Create/start race**: `IncusSubstrate::create()` returned as soon as the create
   request was accepted; `spawn()` then called `start()` before the image had finished
   unpacking. Fixed by increasing the underlying HTTP client timeout from 30s to 180s
   so `wait_operation()` blocks until the create operation completes.
2. **State polling**: Added `IncusDriver::wait_for_running_state()` so `spawn()` does
   not return until the instance reports `Running`.
3. **Host inotify limits**: The VPS hit `fs.inotify.max_user_instances = 128` after
   many test containers. Raised the limit to 1024 and persisted it in
   `/etc/sysctl.d/99-allternit.conf` on `mail`.
4. **Incus proxy Host header**: The HTTP proxy device rejects requests whose `Host`
   header is a non-IP/non-localhost name. The example accepts `INCUS_CDP_HOST` and
   defaults to `INCUS_VNC_HOST`; use the Tailscale IP (`100.108.37.126`) for the CDP
   URL.

## Phase 5 — Web UI VNC viewer

### API flow
1. Provision a bot desktop:
   ```bash
   curl -s -X POST http://127.0.0.1:8013/api/v1/bots/test-desktop-bot/desktop/provision \
     -H "Content-Type: application/json" -d '{}' | jq .
   ```
2. Get status and WebSocket URL:
   ```bash
   curl -s http://127.0.0.1:8013/api/v1/bots/test-desktop-bot/desktop/status | jq .
   ```
   Response includes:
   ```json
   {
     "state": "Running",
     "ws_url": "ws://127.0.0.1:8013/ws/bots/test-desktop-bot/desktop/vnc",
     "protocol": "vnc"
   }
   ```
3. Open a noVNC page pointing at that `ws_url`.
4. The WebSocket handshake returns `RFB 003.008` and the desktop is viewable and
   controllable.

### Key fixes
1. **Nested route path**: `cmd/allternit-api/src/bot_desktop_stream.rs` mounted the
   VNC WebSocket handler at `/bots/:bot_id/desktop/vnc`, but it was nested under
   `/ws/bots`, producing a double `/bots/` segment. Changed the route to
   `/:bot_id/desktop/vnc`.
2. **VNC port parser**: `parse_vnc_port_from_config` looked under `data`, but Incus
   returns the config under `metadata`. Updated the parser to check both locations.

## Test results
```
cargo test -p allternit-computer-cloud
running 12 tests
test driver::tests::normalize_image_maps_defaults ... ok
test driver::tests::parse_vnc_port_extracts_last_colon_value ... ok
test substrate::tests::get_parses_running_state ... ok
test substrate::tests::not_found_returns_error ... ok
test substrate::tests::start_then_get_updates_state ... ok
test substrate::tests::create_returns_native_id_from_resources ... ok
test routes::computers::tests::missing_computer_returns_404 ... ok
test routes::computers::tests::create_computer_returns_201 ... ok
test routes::computers::tests::get_computer_returns_state ... ok
test routes::computers::tests::delete_computer_returns_204 ... ok
test routes::computers::tests::exec_runs_command ... ok
test routes::computers::tests::start_and_stop_update_state ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

```
cargo test -p allternit-api
running 426 tests (lib) + 6 tests (health_metrics) + 14 tests (viz_routes)
test result: ok. 446 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

## ACU gateway health (during run)
```bash
curl -s http://127.0.0.1:8760/v1/computer-use/health
{"status":"ok","adapters":4,"sessions":0,"version":"0.1.0","planning_available":true}
```

## Files changed
- `cmd/allternit-computer-cloud/src/substrate.rs` — increased HTTP timeout to wait
  for long create operations.
- `cmd/allternit-computer-cloud/src/driver.rs` — poll instance state until `Running`
  in `spawn()`; parse VNC port from `metadata` fallback.
- `cmd/allternit-computer-cloud/examples/acu_browser_task.rs` — added `INCUS_CDP_HOST`
  usage and documentation.
- `cmd/allternit-api/src/bot_desktop_stream.rs` — fixed nested route path.

## Constraint check
- No Orgo dependency introduced.
- Each changed module stays under the 1,500 LOC feature limit.
- Proof artifact is a screen recording, not a static screenshot.

## Next
- Harden the MVP: add stop/deprovision endpoints, rate limiting, and persistent bot↔desktop mapping.
