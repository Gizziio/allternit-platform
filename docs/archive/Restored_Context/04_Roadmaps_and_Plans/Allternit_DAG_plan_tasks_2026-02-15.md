# A://TERNIT — DAG Plan & Task/Subtask List (UPDATED 2026-02-24)

This is the dependency-ordered DAG plan for the agent-first, multi-tenant execution fabric.

---

## DAG Status Overview

| ID | Node Name | Status | Implementation |
|----|-----------|--------|----------------|
| N0 | North Star Freeze | ✅ | Complete (Vision Lock) |
| N1 | Repo Alignment Audit | ✅ | Complete (Map & Gaps documented) |
| N2 | Target Architecture Spec | ✅ | Complete (3-layer model defined) |
| N3 | Execution Driver Interface | ✅ | Complete (`allternit-driver-interface` crate) |
| N4 | Substrate Prototype | ⚠️ | Partial (Process & Firecracker Prototype) |
| N5 | Environment Definition | ✅ | Complete (`allternit-environment-spec` with DevContainer/Nix) |
| N6 | Policy Engine + Creds | ✅ | Complete (`policy-engine` integrated) |
| N7 | Swarm Scheduler + DAG | ⚠️ | Partial (Engine integrated, Persistence needed) |
| N8 | Provenance + Obs | ✅ | Complete (`history-ledger` & API wiring) |
| N9 | Supervisory UX | ✅ | Complete (Shell UI & Dashboard views) |
| N10| Marketplace Hardening | ❌ | Not Started |
| N11| Economic Model + Cost | ✅ | Complete (`budget-metering` integrated) |
| N12| Determinism + Replay | ✅ | Complete (`allternit-replay` integrated) |
| N13| Trust Model + Tiering | ✅ | Complete (`policy-tier-gating` integrated) |
| N14| Versioning + Backcompat | ✅ | Complete (Strategy Spec defined) |
| N15| State Storage + Ledger | ✅ | Complete (`history-ledger` authoritative) |
| N16| Prewarm + Cold Start | ✅ | Complete (`allternit-prewarm` integrated) |
| N17| Failure Semantics | ⚠️ | Partial (Driver/Policy errors exists) |
| N18| Compliance + Governance | ⚠️ | Partial (`rust-governor` integrated) |
| N19| Merge Governance | ✅ | Complete (Strategy Spec defined) |
| N20| Self-Hosting + Bootstrap| ✅ | Complete (Plan defined) |

---

## Immediate Remaining Priorities

1. **N10 Marketplace Hardening:** Implement tenant isolation and automated onboarding.
2. **N7 Persistence:** Ensure Workflow executions are persisted to the database.
3. **N4 Driver Completion:** Move Firecracker driver from prototype to production-ready.
4. **N17 Unified Error Taxonomy:** Unify error handling across the execution stack.
