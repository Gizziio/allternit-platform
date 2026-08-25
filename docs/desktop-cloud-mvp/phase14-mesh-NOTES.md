# Phase 14 — Connect guest desktops to Tailscale/Headscale mesh

## Goal
Give every provisioned Linux desktop a stable, routeable IP independent of the Incus bridge NAT by joining it to a mesh VPN. For the MVP we chose a self-hosted Headscale control plane so the platform has no external Tailscale.com dependency.

## What changed
- Added `MeshConfig` abstraction in `cmd/allternit-computer-cloud/src/mesh.rs` (235 LOC).
  - Supports `tailscale` (hosted) and `headscale` (self-hosted) providers.
  - Generates a guest bootstrap script that installs the official Tailscale client and runs `tailscale up --reset --login-server <url> --auth-key <key>`.
  - Provides helpers to parse the Tailscale IP from `tailscale status --json`.
- Wired mesh config into `IncusDriver` via `with_mesh()` and merged mesh env vars into spawned guest specs.
- Added API module `cmd/allternit-api/src/bot_desktop_mesh.rs` (370 LOC):
  - `POST /api/v1/bots/:bot_id/desktop/mesh/join`
  - `GET /api/v1/bots/:bot_id/desktop/mesh/status`
  - `POST /api/v1/bots/:bot_id/desktop/mesh/leave`
- Added routes in `bot_desktop_routes.rs` and env-var based mesh config in `main.rs`.

## Infrastructure set up for the proof
- Installed Headscale v0.29.3 on the VPS (`mail`) at `/usr/local/bin/headscale`.
- Configuration in `/etc/headscale/config.yaml` with:
  - `server_url: https://mail.news.allternit.com:8444`
  - `listen_addr: 0.0.0.0:8081`
  - SQLite database and embedded DERP relay.
- Reverse proxy in nginx on port 8444 with the existing Let's Encrypt certificate, proxying to Headscale 8081 with WebSocket upgrade support for the Noise (`/ts2021`) protocol.
- Created Headscale user `allternit` and a reusable pre-auth key for the demo.

## Test results
```
cargo test -p allternit-computer-cloud
  18 passed; 0 failed
cargo test -p allternit-api bot_desktop
  25 passed; 0 failed
```

## End-to-end proof
Screen recording: `phase14-mesh-proof.webm` (~33 minutes).
Demonstrates:
1. Headscale installation and nginx TLS reverse-proxy configuration on the VPS.
2. API restart with `ALLTERNIT_MESH_PROVIDER=headscale` and the pre-auth key.
3. Provisioning a new Incus desktop for `manual-test-bot`.
4. `POST /api/v1/bots/manual-test-bot/desktop/mesh/join` returning `"joined":true` and Tailscale IP `100.64.0.1`.
5. `GET .../mesh/status` showing `"BackendState":"Running"`, `"Online":true`, and Tailscale IPs.
6. `headscale nodes list` on the VPS showing the guest node online with `100.64.0.1`.

## Known limitations / next steps
- The VPS itself remains on the existing Tailscale.com tailnet; a production deployment would either migrate the host to Headscale or keep them separate with subnet routing.
- ACL tags were omitted from the demo because Headscale v0.29's ACL format changed; tag support can be added once the exact `tagOwners` schema is confirmed.
- Mesh configuration is currently global via env vars. Later phases should allow per-bot/per-tenant mesh selection from the template registry.
- No automatic mesh join in cloud-init yet; the current flow uses the API `join` endpoint after provisioning. Phase 15's CI image pipeline can bake the Tailscale package and a startup script so new desktops join automatically.
