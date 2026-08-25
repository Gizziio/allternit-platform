# Phase 24 — Capacity Monitoring and Autoscaling Signals

## Goal
Surface real-time desktop fleet capacity and emit scale-up signals when the
cluster crosses a utilization threshold. The actual provisioning of new
bare-metal hosts is an external operation; the API stays lightweight by only
producing the signal.

## What changed

### New capacity module
`cmd/allternit-api/src/bot_desktop_capacity.rs` (~240 LOC excluding tests):
- `CapacitySnapshot` — per-provider/host view of total/available CPU and
  memory, active executions, and health.
- `CapacityMonitor` — holds the latest snapshots and recomputes cluster-wide
  utilization on every read.
- Background task `spawn_capacity_monitor` — samples `ExecutionDriver::health_check`
  and `capabilities` every N seconds (default 30s, configurable via
  `DESKTOP_CAPACITY_MONITOR_INTERVAL_SECS`).
- Autoscale signal — when `used_cpu / total_cpu >= DESKTOP_AUTOSCALE_CPU_THRESHOLD`
  (default 80%) the monitor logs a warning and sets `scale_up_recommended: true`.

### API endpoint
`GET /api/v1/desktop-capacity` returns the current `CapacityStatus` including
all snapshots and the scale-up recommendation.

### Wiring
- `cmd/allternit-api/src/lib.rs` exports `bot_desktop_capacity`.
- `cmd/allternit-api/src/main.rs` initializes the global monitor and spawns the
  background sampler; merges the capacity router at `/api/v1`.

## Verification

### Automated tests
```bash
cargo test -q -p allternit-api bot_desktop_capacity
cargo test -q -p allternit-api bot_desktop
```
All 2 capacity tests + 38 desktop tests pass.

### End-to-end
```bash
curl -s -H "Authorization: Bearer dev" http://127.0.0.1:8013/api/v1/desktop-capacity
```
Returns a snapshot such as:
```json
{
  "scale_up_recommended": false,
  "scale_up_reason": null,
  "snapshots": [
    {
      "provider": "microvm",
      "host": "default",
      "healthy": true,
      "active_executions": 0,
      "total_cpu_millis": 8000,
      "available_cpu_millis": 8000,
      "total_memory_mib": 32768,
      "available_memory_mib": 32768,
      "scaled_at": "..."
    }
  ]
}
```

## Size gate
- `bot_desktop_capacity.rs`: ~240 LOC (under 1,500)

## Artifacts
- Screen recording: `phase24-capacity-demo.webm`
- This notes file: `phase24-capacity-NOTES.md`

## Known limitations / next work
- Capacity is estimated from driver capabilities and active execution count,
  not from real host-level metrics.
- Only scale-up signals are emitted; scale-down and host provisioning are not
  automated.
- Next phase: billing/metering that consumes the `desktop_usage` table created
  in Phase 23.
