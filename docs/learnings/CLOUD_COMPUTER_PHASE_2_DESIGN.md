# Cloud Computer Phase 2 — Lifecycle parity (DESIGN)

Spec rq-20260909-004 Phase 2. Facts verified 2026-09-09 against main
(`dc032c217`, includes Phase 1 / PR #201). The executor must not re-litigate
the decisions in `CLOUD_COMPUTER_PHASE_2_TASK.md`.

## Current router (post-Phase 1, `computer_routes.rs:131-159`)

`/api/v1/computers` has list/create/get/start/restart/stop/delete/session-end/
screenshot/mouse/keyboard/shell/files/snapshots + admin/credits. Key helpers to
reuse (exact names on main):
- `create_standalone_desktop(state, user, req, owner: (String, String)) -> Response` (`:667`)
- `computer_sandbox(state, computer) -> Result<Option<BotDesktopSandboxRecord>, Response>` (`:1175`)
- `snapshot_driver_and_handle(state, user, id) -> (Arc<dyn ExecutionDriver>, ExecutionHandle)` (`:1642`)
- `build_handle(native_id, os, provider)` in `bot_desktop_routes.rs:1096` (tenant "lifecycle")
- `check_computer_credits` helper (Phase 1, used by create paths)
- Validated sets: `VALIDATED_CPU_CORES/MEMORY_MB/DISK_MB` + `validate_provision_request` in `bot_desktop_templates.rs`

## Substrate mechanics (verified)

### Incus (`cmd/allternit-computer-cloud/src/`)
- `IncusDriver` (`driver.rs:34`) → `IncusSubstrate` (`substrate.rs:223`), reqwest HTTP client against Incus REST `/1.0` (no CLI). TLS client-cert auth.
- Create already sets `"config": {"limits.cpu": n, "limits.memory": "NMiB"}` inline (`substrate.rs:362-365`).
- `PATCH /1.0/instances/{id}` proven via `add_proxy_device` (`substrate.rs:666-695`); `get_config` = `GET /1.0/instances/{id}` (`substrate.rs:698`).
- stop/start via `PUT /1.0/instances/{id}/state` `{"action":"start|stop"}` (`substrate.rs:644-663`); destroy = stop + DELETE (`:410-425`).
- Snapshots: POST `/instances/{id}/snapshots`, restore in-place, list, delete (`substrate.rs:545-640`). **No create-new-instance-from-snapshot exists** (no `source: {"type":"copy"|"snapshot"}` POST anywhere).
- **No resize, no clone.**

### Tart (`cmd/allternit-computer-cloud/src/tart.rs`)
- `TartDriver` (`tart.rs:36`) → HTTP to `allternit-tart-host` wrapper services (default `http://127.0.0.1:8020`, bearer `TART_HOST_TOKEN`). Wrapper shells out to Tart CLI.
- create `POST /v1/vms/{name}/create` (cpu/memory **at create only**), start, poll running. stop/start/delete endpoints exist. **No snapshot impl (capabilities advertise snapshot:false, `tart.rs:202`), no resize, no clone.**

### Driver interface (`platform/contracts/driver-interface/src/lib.rs`)
- `ExecutionDriver` trait: spawn/pause_vm/resume_vm/exec/destroy + desktop opt-ins + snapshot methods (default `NotSupported`, `:659-707`).
- `ResourceSpec{cpu_millis, memory_mib, disk_mib, network_egress_kib, gpu_count}` (`:150`).
- `DriverCapabilities` exists (Tart sets `snapshot: false`) — has per-feature flags.
- **No resize_vm / clone_vm methods. No clone-from fields on SpawnSpec.**

### Background loops (`cmd/allternit-api/src/main.rs`)
Established pattern (`:422-437`): clone AppState, subscribe process-wide `broadcast::channel::<()>(1)` shutdown, `tokio::spawn`, `tokio::time::interval(period)` + `MissedTickBehavior::Skip`, `tokio::select!` shutdown vs tick. Existing loops: capacity monitor 30s (`:563`), provision queue worker 10s (`:585`), usage→cost 60s, host provisioner 60s. **No desktop idle reaper exists.**

### DB (migration pattern is active: V133+ free)
- `computers` (V99): no idle/group columns. `computer_cloud_desktop` has `control_state` ('bot_controls'|'human_controls'|'human_observing') + `taken_over_by_user_id`.
- `desktop_usage` (V96): per bot session `started_at/ended_at` — too coarse for idle; don't use.
- `state.bot_desktop_sessions`: in-memory `HashMap<bot_id, BotDesktopSession{control_state, taken_over_by_user_id, ...}>` (`lib.rs:337-379`) — no activity timestamps.
- `bot_groups` (V132): bot-only groups, not linked to computers.
- Migrations run from `cmd/allternit-api/migrations/`; latest is V132 → **V133/V134 free**.

## Orgo matrix rows Phase 2 closes

| # | Capability | Approach |
|---|---|---|
| 5 | Live resize | new `resize_vm` trait method; Incus PATCH limits live + disk stopped-only; Tart 501 |
| 6 | One-call clone | new `clone_vm` trait method; Incus snapshot→create-from-snapshot; Tart 501 |
| 8 | Auto-stop | `idle_timeout_secs` + `last_activity_at` columns; activity touch in control handlers; 60s sweeper loop |
| 7/22 | Workspaces-lite | label-first groups: `computer_groups` table + `computers.group_id`; group CRUD + attach/detach; `?group_id=` filter |
