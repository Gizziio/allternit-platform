# A://RCHITECH — Repo Alignment Audit (N1)
## 3-Layer Architecture Mapping

This document maps the current workspace members to the A://RCHITECH 3-Layer Model.

---

### Layer 1: Kernel (Execution Fabric)
*The foundation for autonomous execution, sandboxing, and resource management.*

| Module | Purpose |
|--------|---------|
| `1-kernel/execution/a2r-process-driver` | Direct process execution driver. |
| `1-kernel/infrastructure/a2r-driver-interface` | Common contract for execution substrates. |
| `1-kernel/infrastructure/a2r-environment-spec` | Environment definition (N5) and portable specs. |
| `4-services/orchestration/a2r-prewarm` | Latency optimization for execution units (N16). |
| `1-kernel/a2r-kernel/runtime-execution-core` | Low-level runtime management. |
| `1-kernel/communication/kernel-messaging` | Event bus for inter-process communication. |
| `1-kernel/data/history-ledger` | Authoritative run ledger (N15). |
| `1-kernel/capsule-system/a2r-capsule` | Unit of deployment and execution. |

### Layer 2: Control Plane (Governance & Orchestration)
*Policy enforcement, scheduling, and swarm coordination.*

| Module | Purpose |
|--------|---------|
| `2-governance/identity-access-control/policy-engine` | Policy-as-code enforcement (N6). |
| `4-services/orchestration/budget-metering` | Economic model and cost attribution (N11). |
| `1-kernel/infrastructure/swarm-advanced` | Advanced swarm scheduling (N7). |
| `2-governance/a2r-replay` | Determinism and replay (N12/N8). |
| `1-kernel/control-plane/a2r-control/control-plane-impl` | Primary orchestration logic. |
| `1-kernel/control-plane/a2r-agent-orchestration/workflows` | Workflow DAG execution (N7). |
| `2-governance/identity-access-control/policy-tier-gating` | Trust model and tiering (N13). |

### Layer 3: Experience (Interface & UX)
*Human-in-the-loop, observability, and operator tools.*

| Module | Purpose |
|--------|---------|
| `7-apps/api` | Primary entry point for all A2R services. |
| `6-ui` | Shell UI and Supervisory dashboards (N9). |
| `3-adapters/mcp` | Model Context Protocol bridge for LLM interaction. |
| `4-services/io-service` | Tool gateway and input/output abstraction. |

---

### Gap Analysis Summary (Initial)
- **N4 (Substrate):** `a2r-process-driver` exists, but Kata/Firecracker drivers are missing.
- **N10 (Marketplace):** Onboarding and multi-tenant quotas need hardening.
- **N17 (Failure Semantics):** Explicit failure taxonomy is not yet standardized.
- **N18 (Compliance):** Governance workflows exist but lack full audit/governance exports.
- **N20 (Self-Hosting):** Bootstrap plan needs documentation.
