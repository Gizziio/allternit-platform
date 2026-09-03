# Phase 3 Checkpoint — Platform API Integration

## Feature
Wire the Allternit platform API (`cmd/allternit-api`) to provision bot desktops
through the Incus-backed `allternit-computer-cloud` driver.

## Constraint compliance
- **LOC:** ~580 lines of new/changed feature code (driver.rs 361, example 123,
  substrate extensions ~80, API integration ~15) — under the 1,500 limit.
- **No Orgo dependency:** only Incus + Tailscale + the existing
  `allternit-driver-interface`.

## What it does
- Adds `allternit-computer-cloud::IncusDriver`, an `ExecutionDriver`
  implementation that maps `SpawnSpec` to `ComputerSpec` and exposes a VNC
  desktop endpoint.
- Extends `IncusSubstrate` with:
  - TLS client-certificate auth for remote Incus HTTPS.
  - optional insecure skip-verify for self-signed Incus certs.
  - proxy-device management so x11vnc is reachable on the Incus host.
  - file pull via the Incus files API.
  - robust operation waiting (uses `/wait`, falls back to original response on
    404 for operations that complete too fast).
- Configures `initialize_vm_driver` in `cmd/allternit-api/src/main.rs` to pick
  the Incus driver when `INCUS_URL` is set.
- Provides an example binary that provisions a desktop, waits for cloud-init,
  and captures a screenshot through the driver.

## Configuration

```bash
export INCUS_URL=https://mail:8443
export INCUS_VNC_HOST=mail                    # Tailscale hostname for VNC
export INCUS_CLIENT_CERT=~/.config/allternit/incus/client.crt
export INCUS_CLIENT_KEY=~/.config/allternit/incus/client.key
export INCUS_INSECURE_SKIP_VERIFY=true
export INCUS_DESKTOP_PROFILES=default,allternit-desktop
export BOT_DESKTOP_IMAGE=ubuntu/24.04/cloud
```

## Verification

### Unit tests

```bash
cd /Users/joe/Desktop/allternit-workspace/allternit-session-desktop-cloud-mvp
cargo test -p allternit-computer-cloud
```

Result: 12 passed.

### Platform API compile check

```bash
cargo check -p allternit-api
```

Result: clean build (only pre-existing warnings).

### Golden image

A pre-baked local Incus image `allternit-desktop` was published from the
cloud-init-provisioned container so that driver launches do not depend on
runtime apt/DNS. Publish command on the VPS:

```bash
incus stop desktop-cloudinit-test
incus publish desktop-cloudinit-test --alias allternit-desktop --compression zstd
```

### End-to-end driver example

```bash
INCUS_URL=https://mail:8443 \
INCUS_VNC_HOST=mail \
INCUS_CLIENT_CERT=~/.config/allternit/incus/client.crt \
INCUS_CLIENT_KEY=~/.config/allternit/incus/client.key \
INCUS_INSECURE_SKIP_VERIFY=true \
INCUS_DESKTOP_PROFILES=default \
DESKTOP_PROOF_PATH=docs/desktop-cloud-mvp/phase3-driver-proof.png \
cargo run -p allternit-computer-cloud --example provision_desktop
```

The example prints the allocated native_id and VNC endpoint, waits for
`x11vnc` to appear, takes a screenshot with `scrot`, pulls it via the
Incus files API, writes it to
`docs/desktop-cloud-mvp/phase3-driver-proof.png`, and destroys the
instance.

Result:

```
Provisioning desktop...
Spawned native_id: allternit-bot-example-78e2a2c601924b83b6059d81e398c116
Desktop endpoint: tcp://mail:30005 (password: Some("allternit"))
Waiting for desktop services...
x11vnc ready after 1 attempts
Taking screenshot...
Screenshot written to .../phase3-driver-proof.png (487788 bytes)
Destroyed allternit-bot-example-78e2a2c601924b83b6059d81e398c116
```

## Files changed
- `cmd/allternit-computer-cloud/src/driver.rs` — new Incus `ExecutionDriver`.
- `cmd/allternit-computer-cloud/src/substrate.rs` — TLS, proxy devices, file
  pull, Incus-compatible response parsing, profiles support.
- `cmd/allternit-computer-cloud/src/routes/computers.rs` — expose `profiles`
  in create request.
- `cmd/allternit-computer-cloud/examples/provision_desktop.rs` — end-to-end
  driver proof.
- `cmd/allternit-api/src/main.rs` — initialize Incus driver from env.
- `cmd/allternit-api/Cargo.toml` — depend on `allternit-computer-cloud`.
- `cmd/allternit-computer-cloud/Cargo.toml` — add driver-interface,
  urlencoding, rustls-tls, base64 dev-dep.

## Notes / caveats
- The current driver stores the allocated VNC proxy port in memory. After an
  API restart it can recover the port by re-reading the Incus instance config.
- stdout/stderr from `exec` are not captured yet; the example works around
  this by redirecting command output to a file and pulling the file.
- The platform `/bots/:bot_id/desktop/*` routes already existed for
  OpenSandbox; they now reuse the same `vm_driver` abstraction with Incus.

## Next step
Phase 4: run a browser-automation task (ACU/gizzi computer tool) on the
cloud-provisioned desktop.
