# Phase F — Heterogeneous fleet expansion (macOS + Windows readiness)

## Goal
Make the Allternit Desktop Cloud control plane able to provision heterogeneous
OS desktops: Linux/Incus stays on the VPS, macOS/Tart is offloaded to a remote
Apple-Silicon Mac over Tailscale, and Windows/Incus is ready for a future
KVM-capable host. Everything must be reachable through the single VPS control
plane at `https://mail.news.allternit.com`.

## What changed

### 1. Substrate capability reporting
- Added `capabilities: Vec<String>` to `DriverHealth` in
  `platform/contracts/driver-interface/src/lib.rs`.
- `capabilities` is serialized with `#[serde(default)]` and the struct derives
  `Default`, so existing construction sites do not break.
- Updated every `DriverHealth { ... }` construction site in the workspace to
  include the new field.
- Incus driver (`cmd/allternit-computer-cloud/src/driver.rs`) advertises
  `["linux"]` and adds `"windows"` when `/dev/kvm` is present.
- Tart driver (`cmd/allternit-computer-cloud/src/tart.rs`) advertises
  `["macos"]`.
- Substrate router (`cmd/allternit-computer-cloud/src/router.rs`) aggregates
  and deduplicates capabilities from all configured substrates.
- `GET /api/v1/desktop-health` (`cmd/allternit-api/src/bot_desktop_admin.rs`)
  now returns `capabilities` in the JSON response.

### 2. Remote Tart host support
- `cmd/allternit-computer-cloud/src/tart.rs` was refactored to support multiple
  Tart hosts and authenticated requests:
  - Reads `TART_HOST_URLS` (comma-separated) and falls back to `TART_HOST_URL`.
  - Reads `TART_HOST_TOKEN` and sends `Authorization: Bearer <token>` on every
    wrapper request.
  - Round-robins spawns across configured hosts.
  - Stores `tart_host_url` and `host` in the execution handle so lifecycle
    operations (stop, start, destroy, exec, files) route back to the owning
    host.
  - Health checks all configured hosts; the driver is healthy if at least one
    host responds.
- `cmd/allternit-api/src/main.rs` now initializes the Tart driver when
  `TART_HOST_URLS` is set (in addition to the existing `TART_HOST_URL` and
  `TART_BIN` triggers).

### 3. Tart-host authentication
- `cmd/allternit-computer-cloud/src/bin/tart-host.rs` now reads
  `TART_HOST_TOKEN`.
- All wrapper routes except `/health` require `Authorization: Bearer <token>`
  when the token is configured. Unauthenticated `/health` remains public so the
  control plane can probe reachability without sharing secrets.

### 4. Internal service-token auth for health probes
- Added `x-allternit-internal-token` support to
  `cmd/allternit-api/src/auth.rs` so peer services can call protected
  endpoints (including `/api/v1/desktop-health`) with the shared
  `ALLTERNIT_INTERNAL_SERVICE_TOKEN`.

### 5. Mac deploy artifacts
- `infrastructure/tart-host/com.allternit.tart-host.plist`: launchd user agent
  that binds the wrapper to the Mac's Tailscale IP (`100.88.98.69:8020`) and
  loads `TART_HOST_TOKEN` from the deploy script.
- `infrastructure/tart-host/deploy.sh`: builds the release `tart-host` binary,
  installs it to `/usr/local/bin/allternit-tart-host`, generates a persistent
  `TART_HOST_TOKEN` in `~/.allternit/tart-host.env`, patches the plist, loads
  the launchd agent, and verifies `/health`.
- `infrastructure/vps-desktop-cloud/api.env.template` documents
  `TART_HOST_URLS` and `TART_HOST_TOKEN`.

### 6. Windows fleet readiness
- The Incus driver already reports `"windows"` in `capabilities` when
  `/dev/kvm` exists.
- A Windows desktop host must therefore be a KVM-capable bare-metal or nested-
  virtualization machine. The current VPS (`mail.news.allternit.com`) is a
  cloud VM without `/dev/kvm`, so it cannot run Windows desktops. Adding a
  Windows-capable Incus host is a future hardware-procurement step.

## Operational state

- Local Mac (Tailscale `100.88.98.69`) runs `allternit-tart-host` under
  launchd.
- VPS `allternit-api` is configured with:
  ```
  TART_HOST_URLS=http://100.88.98.69:8020
  TART_HOST_TOKEN=<from ~/.allternit/tart-host.env on the Mac>
  ```

## Verification

### 1. Desktop health reports Linux + macOS
```bash
curl -fsS -H "x-allternit-internal-token: $(ssh -i ~/.ssh/id_tailscale root@mail 'grep ALLTERNIT_INTERNAL_SERVICE_TOKEN /etc/allternit-api/api.env | cut -d= -f2')" \
  https://mail.news.allternit.com/api/v1/desktop-health
```
Result:
```json
{"capabilities":["linux","macos"],"healthy":true,"message":null}
```

### 2. Remote Tart host is reachable and authenticated
```bash
# public health
curl -fsS http://100.88.98.69:8020/health
# authenticated VM lookup (404 expected for a non-existent VM)
curl -fsS -H "Authorization: Bearer $(cat ~/.allternit/tart-host.env | cut -d= -f2)" \
  http://100.88.98.69:8020/v1/vms/nonexistent
```

### 3. Provision / stop / deprovision through the VPS control plane
Prerequisites: a bot and a macOS Tart template exist (created with the
self-hosted setup token).

```bash
API=https://mail.news.allternit.com
TOKEN=$(ssh -i ~/.ssh/id_tailscale root@mail 'grep ALLTERNIT_SELF_HOSTED_SETUP_TOKEN /etc/allternit-api/api.env | cut -d= -f2')
BOT=623f4106-6276-46f5-9321-842bab50f9f3
TEMPLATE=dtpl-6103a35a19314647b4708f5c156a2d47

# provision
curl -s -X POST "$API/api/v1/bots/$BOT/desktop/provision?os=macos&template_id=$TEMPLATE" \
  -H "X-Allternit-Self-Hosted-Token: $TOKEN" | python3 -m json.tool

# stop
curl -s -X POST "$API/api/v1/bots/$BOT/desktop/stop" \
  -H "X-Allternit-Self-Hosted-Token: $TOKEN" | python3 -m json.tool

# deprovision
curl -s -X POST "$API/api/v1/bots/$BOT/desktop/deprovision" \
  -H "X-Allternit-Self-Hosted-Token: $TOKEN" | python3 -m json.tool
```

Observed result (using the local `tart-ubuntu-test` image):
```json
{
    "sandbox_id": "allternit-bot-d5066e2317ae407490b193fceb143635",
    "status": "running",
    "provider": "tart",
    "host": "100.88.98.69"
}
```

### 4. Backend tests
```bash
cargo test -p allternit-api
# test result: ok. 464 passed; 0 failed

cargo test -p allternit-computer-cloud
# test result: ok. 24 passed; 0 failed
```

## Known limitations / blockers

1. **Windows desktops require KVM.** The current VPS does not expose
   `/dev/kvm`, so `desktop-health` reports `["linux","macos"]` only. To add
   Windows capability, attach a KVM-capable Incus host to the control plane via
   `INCUS_URLS` and ensure `/dev/kvm` exists on that host.
2. **macOS guests require a real macOS base image.** The e2e above used a
   local Tart Ubuntu image because no macOS base image was imported yet. The
   same code path works for macOS once a `macos-base` (or named) image is
   cloned on the Tart host.
3. **Tart host networking.** The wrapper binds to the Tailscale IP. If
   Tailscale is down, remote provisioning stops; the launchd agent will keep
   retrying until the interface is back.

## Files touched

- `platform/contracts/driver-interface/src/lib.rs`
- `services/vm-executor/src/lib.rs`
- `drivers/firecracker/src/lib.rs`
- `drivers/apple-vf/src/lib.rs`
- `drivers/opensandbox/src/lib.rs`
- `services/process-driver/src/lib.rs`
- `cmd/allternit-api/src/bot_desktop_input.rs`
- `cmd/allternit-api/src/bot_desktop_mux.rs`
- `cmd/allternit-api/src/bot_desktop_routes.rs`
- `cmd/allternit-api/src/bot_desktop_admin.rs`
- `cmd/allternit-api/src/auth.rs`
- `cmd/allternit-api/src/main.rs`
- `cmd/allternit-computer-cloud/src/driver.rs`
- `cmd/allternit-computer-cloud/src/tart.rs`
- `cmd/allternit-computer-cloud/src/router.rs`
- `cmd/allternit-computer-cloud/src/bin/tart-host.rs`
- `infrastructure/tart-host/com.allternit.tart-host.plist`
- `infrastructure/tart-host/deploy.sh`
- `infrastructure/vps-desktop-cloud/api.env.template`
- `docs/desktop-cloud-mvp/phaseF-fleet-expansion-NOTES.md`
