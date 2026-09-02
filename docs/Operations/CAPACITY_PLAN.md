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
| 512 MB | ~34 | $0.0079/hr | ~$193 | ~$15 | ~13x |
| 1 GB | ~17 | $0.0079/hr | ~$97 | ~$15 | ~6.5x |
| 2 GB | ~8 | (2x rate) | ~$91 | ~$15 | ~6x |

\* current `cost_rates.cost_per_hour` snapshot used in metering = $0.0079/hr. RAM-cost basis: €14 ÷ 720h ÷ 17GB ≈ €0.0011/GB-hr → metering at $0.0079/hr per 1GB container is a ~7x markup on raw RAM cost; CPU (8 vCPU, bursty dev workloads) is not the constraint at this density.

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
