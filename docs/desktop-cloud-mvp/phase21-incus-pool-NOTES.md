# Phase 21 — Multi-host Incus pool

## Goal
Let the control plane spread Linux/Windows desktops across more than one Incus
host. A single API provision request should be scheduled to an available Incus
server, and every lifecycle operation for that VM must return to the same
server.

## What changed

### New pool module
`cmd/allternit-computer-cloud/src/incus_pool.rs` (182 LOC) adds:
- `IncusHost`: URL, derived VNC host, substrate client, scheduling weight.
- `IncusHostPool`: round-robin selection for new spawns, lookup by stored
  `host_url` for lifecycle ops, fallback to the first host for legacy handles.
- Zero-weight hosts are skipped by the scheduler (useful for hot spares or
  draining hosts).

### Driver updates
`cmd/allternit-computer-cloud/src/driver.rs` now holds an `IncusHostPool`
instead of a single `Arc<IncusSubstrate>`:
- `spawn()` selects a host, stores `host_url` + `host` in `driver_info`, and
  uses that host's substrate for create/start/VNC proxy setup.
- `pause_vm`, `resume_vm`, `destroy`, `exec`, file transfers, and snapshot
  calls all resolve the owning host from the handle before issuing requests.
- `expose_port()` and `get_desktop_endpoint_by_native_id()` fall back to the
  first host when the owner is unknown (legacy paths).
- New constructors:
  - `IncusDriver::from_pool(pool, fallback_vnc_host)`
  - `IncusDriver::from_urls(&[String], fallback_vnc_host)`

### API wiring
`cmd/allternit-api/src/main.rs` now reads `INCUS_URLS` (comma-separated) first,
falling back to `INCUS_URL`. Multiple URLs build a multi-host pool; a single URL
keeps the previous behavior.

## Verification

### Automated tests
```bash
cargo test -q -p allternit-computer-cloud incus_pool
cargo test -q -p allternit-api bot_desktop
```
All 24 computer-cloud tests + 30 API desktop tests pass.

### End-to-end
With `INCUS_URL=https://mail:8443` the API starts as a single-host pool and
still routes Linux provisioning to Incus (the VPS lacks the desktop image, so it
returns the expected Incus `Instance not found` error):

```bash
curl -s -X POST \
  "http://127.0.0.1:8013/api/v1/bots/router-test-1/desktop/provision?os=linux" \
  -H "Authorization: Bearer dev"
```

## Size gate
- `incus_pool.rs`: 182 LOC
- `driver.rs`: 654 LOC
- Total Incus pool feature: ~836 LOC (well under 1,500)

## Artifacts
- Screen recording: `phase21-incus-pool-demo.webm`
- This notes file: `phase21-incus-pool-NOTES.md`

## Known limitations / next work
- Only round-robin + weight-based skipping; no real-time capacity or health
  feedback from hosts yet.
- The current fleet has one Incus host, so multi-host scheduling is exercised in
  unit tests. A second Incus host is needed for a live multi-host demo.
- Next phase: template registry and presets so users can pick from curated
  desktop environments instead of raw image aliases.
