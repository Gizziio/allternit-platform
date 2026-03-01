# A://RCHITECH — Audit Gap Matrix (N1)
## Status of DAG Nodes N1-N20

| ID | Task Name | Status | Depth | Implementation Notes |
|----|-----------|--------|-------|----------------------|
| N1 | Repo Alignment Audit | ✅ | Full | Mapping complete in `Audit_3Layer_Map.md`. |
| N2 | Target Architecture Spec | ⚠️ | Partial | Defined in docs, but contracts need refinement. |
| N3 | Execution Driver Interface | ✅ | Full | `a2r-driver-interface` crate is stable. |
| N4 | Substrate Choice + Proto | ⚠️ | Partial | Process driver done; MicroVM driver missing. |
| N5 | Env Definition Layer | ✅ | Full | `a2r-environment-spec` implements N5. |
| N6 | Policy Engine + Creds | ✅ | Full | `policy-engine` and `policy-tier-gating` exist. |
| N7 | Swarm Scheduler + DAG | ⚠️ | Partial | `swarm-advanced` exists; workflow engine is 20%. |
| N8 | Provenance + Obs | ⚠️ | Partial | `history-ledger` exists; Replay is integrated. |
| N9 | Supervisory UX | ⚠️ | Partial | Shell UI exists but needs operator-first views. |
| N10| Marketplace Hardening | ❌ | None | Multi-tenancy isolation logic needed. |
| N11| Economic Model + Cost | ✅ | Full | `budget-metering` is fully integrated. |
| N12| Determinism + Replay | ✅ | Full | `a2r-replay` crate is integrated into API. |
| N13| Trust Model + Tiering | ✅ | Full | `policy-tier-gating` implements trust classes. |
| N14| Versioning + Compatibility| ❌ | None | Schema versioning strategy needed. |
| N15| State Storage + Ledger | ✅ | Full | `history-ledger` and `memory` crates exist. |
| N16| Prewarm + Cold Start | ✅ | Full | `a2r-prewarm` is integrated and tested. |
| N17| Failure Semantics | ⚠️ | Partial | `DriverError` and `PolicyError` exist but not unified. |
| N18| Compliance + Governance | ⚠️ | Partial | `rust-governor` exists; needs audit reporting. |
| N19| Merge Governance | ❌ | None | PR/Release gate automation needed. |
| N20| Self-Hosting + Bootstrap| ❌ | None | Deployment/Bootstrap automation needed. |

---

## Critical Gaps for Immediate Focus
1. **N7 Workflow DAGs:** Only 20% complete. Needs API endpoints and persistence.
2. **N4 MicroVM Substrate:** Currently limited to host process execution.
3. **N9 Operator UX:** UI needs to be optimized for "Governance" over "Development".
4. **N17 Unified Error Taxonomy:** Unify error handling across Driver, Policy, and Scheduler.
