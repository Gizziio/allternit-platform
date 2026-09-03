# Allternit Cloud — Multi-Tenant VPS Capacity Plan (Phase 5)

**Date:** 2026-09-02
**Model:** partition Contabo VPSes into per-user Docker workload containers (many users per node), metered per wall-clock hour. No per-user VMs — margin comes from density.

## Node economics (Contabo Cloud VPS 8)

Reference node: 8 vCPU / 24 GB RAM / 300 GB SSD, €14/mo (incl. VAT, 24-mo rate; ~$15). Unlimited traffic (fair use).

- Reserved for OS + control plane (Postgres, API, Headscale, nginx, Prometheus/Grafana/Alertmanager): ~6 GB RAM
- Workload capacity per node: **~17 GB RAM**
- Container sizes by plan tier: 512 MB / 1 GB / 2 GB (memory ceilings in `plan_tiers`)

| Container size | Concurrent per node | Metered rate* | Always-on revenue/node/mo | Node cost | Gross margin |
|---|---|---|---|---|---|
| 512 MB | ~34 | $0.0075/hr | ~$184 | ~$15 | ~12x |
| 1 GB | ~17 (RAM) / ~8 (CPU at 1 vCPU each) | $0.0150/hr | ~$183 (RAM-bound) | ~$15 | ~12x |
| 2 GB | ~8 | $0.0290/hr | ~$167 | ~$15 | ~11x |

\* retail rates shipped 2026-09-03 (`cost_rates`: contabo/hosted/hosted-{512,1024,2048}mb). Cost basis: VPS 8 ≈ $15/mo = $0.0208/hr whole node; a 1GB/1vCPU container is ~1/8 node = $0.0026/hr raw → $0.015/hr ≈ 5.8x cost, competitive with Fly retail ($0.0079/GB-hr) and well under Railway (~$0.028/GB-hr). CPU is the binding constraint at 1 vCPU per 1GB container — real-world packing lands between the CPU and RAM bounds depending on workload.

**Idle auto-stop is the margin multiplier.** Real users are not always-on. With `HOSTED_RUNTIME_IDLE_TIMEOUT_MINUTES` stopping idle containers, capacity is governed by *concurrent active* containers, not total users. At 20% average activity, one VPS 8 carries ~85 pro-tier users (1 GB each) before RAM pressure.

## Current fleet (2026-09-02)

| Node | Role | Specs | Workload capacity |
|---|---|---|---|
| `mail` (45.84.138.187 / 100.108.37.126) | Control plane + workloads | 8 vCPU / 23 GB / 193 GB (53% used) | ~17 GB (shared with control plane) |
| `allternit-standby` (31.220.95.165 / 100.83.199.24) | Postgres streaming replica + cold API standby (HA, **not capacity**); currently loaned to AllternitOS ISO builds | 8 vCPU / 23 GB / 290 GB | none (reserved) |
| New Contabo VPS 8 (provisioned, not yet enrolled) | First dedicated workload node | 8 vCPU / 24 GB / 300 GB | ~20 GB |

## Scaling procedure (add a workload node)

Trigger: available RAM < 25% for a sustained day, or concurrent containers > 70% of capacity, or disk > 75%.

1. Order Cloud VPS 8 in the Contabo panel (same region as `mail` for latency).
2. Enroll in Tailscale: `curl -fsSL https://tailscale.com/install.sh | sh && tailscale up` (auth via tailnet). Harden SSH (key-only), install Docker.
3. Register the node in `hosted_runtime_nodes` (or the provider config the provisioner reads) so `ContaboRuntimeService` can target its Docker daemon over the tailnet.
4. Verify: provision one test container, heartbeat, auto-stop, destroy.

## Known gap (Phase 5.5, not yet built)

`ContaboRuntimeService` today drives the **local** Docker daemon on `mail` — every container lands on one node. Before the third node carries production workloads the provisioner needs node selection (least-loaded node, tailnet Docker API). Interim policy: `mail` absorbs all workloads until RAM trigger fires, then node selection becomes the blocking feature.

## Guardrails already in place

- Per-tier memory ceilings + instance-count limits (`quota_service.check_hosted_runtime_creation`)
- Monthly hours cap + spend cap (credit-balance aware, fixed 2026-09-02)
- Idle-timeout auto-stop and monthly-cap auto-stop (60s reconciler)
- Wake-on-demand re-checks quota before starting a stopped container (fixed 2026-09-02)
- Failover runbook: `docs/Operations/FAILOVER_RUNBOOK.md` (standby is HA, keep it out of the capacity pool)
