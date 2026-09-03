# Phase 20 — Substrate Router (Incus + Tart)

## Goal
Provide a single `ExecutionDriver` that transparently routes desktop provisioning to the right substrate:
- Linux / Windows → Incus (`allternit-computer-cloud::driver::IncusDriver`)
- macOS → Tart (`allternit-computer-cloud::tart::TartDriver`)

The API continues to hold one `Arc<dyn ExecutionDriver>`; the router is swapped in at startup so no route code needs to know which backend is running.

## What changed

### New router
`cmd/allternit-computer-cloud/src/router.rs` (421 LOC) introduces `SubstrateRouter`:
- Implements `ExecutionDriver`.
- `spawn()` inspects `EnvironmentSpec.env_vars["ALLTERNIT_DESKTOP_OS"]`:
  - `"macos"` → Tart driver.
  - anything else → Incus driver.
- Lifecycle ops (`start`, `stop`, `destroy`, `exec`, `get_desktop_endpoint`, …) dispatch by reading `handle.driver_info["provider"]`.
- `get_desktop_endpoint_by_native_id()` tries every registered driver because the native ID alone does not encode the provider.
- Health / capabilities aggregate all drivers.

### API wiring
`cmd/allternit-api/src/main.rs` now builds both drivers (when their env vars are present) and wraps them in `SubstrateRouter`.

`cmd/allternit-api/src/bot_desktop_routes.rs`:
- Injects `ALLTERNIT_DESKTOP_OS` into `EnvironmentSpec` from the `?os=` query parameter.
- `build_handle(native_id, os)` reconstructs a handle with both `native_id` and `provider` so lifecycle calls route correctly after an API restart.

### Arity fix
`bot_desktop_input.rs` and `bot_desktop_mesh.rs` call `build_handle(sandbox_id, None)` because those code paths are Linux-only; the provider is inferred as Incus.

## Verification

### Automated tests
```bash
cargo test -p allternit-computer-cloud router
cargo test -p allternit-api bot_desktop
```
All 21 router tests + 30 API desktop tests pass.

### End-to-end routing
With both `INCUS_URL` and `TART_HOST_URL` set:

```bash
# macOS -> Tart
curl -s -X POST \
  "http://127.0.0.1:8013/api/v1/bots/router-test-1/desktop/provision?os=macos" \
  -H "Authorization: Bearer dev"
# {"sandbox_id":"...","status":"creating","provider":"tart","host":"127.0.0.1"}

# Linux -> Incus (host currently lacks the Incus image, so it errors from Incus)
curl -s -X POST \
  "http://127.0.0.1:8013/api/v1/bots/router-test-2/desktop/provision?os=linux" \
  -H "Authorization: Bearer dev"
# {"error":"failed to provision desktop sandbox: Execution not found: ... Instance not found"}
```

The Linux call reaches the Incus driver and returns an Incus-specific error, proving routing works.

## Size gate
- `router.rs`: 421 LOC
- `bot_desktop_routes.rs`: 1,427 LOC (still under 1,500)

## Artifacts
- Screen recording: `phase20-substrate-router-demo.webm`
- This notes file: `phase20-substrate-router-NOTES.md`

## Known limitations / next work
- Linux provisioning is blocked on the VPS until a valid desktop image exists in Incus.
- Windows path is code-ready but similarly needs a Windows Incus image.
- Next phase: multi-host Incus fleet.
