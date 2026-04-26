# A://TERNIT — DAG Extension: Missing-Gap Nodes (N11–N20) (2026-02-15)

This file extends the existing DAG with additional nodes for the gaps identified after the initial plan.

---

## Updated DAG: Nodes + Dependencies (incremental)

Existing core chain remains:
- N0 → N1 → N2 → N3 → (N4,N5,N6) → N7 → N8 → N9 → N10

New nodes add cross-cutting requirements and should be integrated **before** N10 (Marketplace Hardening) and in some cases before N4 (Substrate Driver hardening).

### New Nodes
- **N11 Economic Model + Cost Attribution**
- **N12 Determinism Envelope + Replay Contract**
- **N13 Trust Model + Tenant Tiering**
- **N14 Versioning + Backwards Compatibility**
- **N15 State Storage + Event/Run Ledger**
- **N16 Prewarm + Cold Start Strategy**
- **N17 Failure Semantics + Quarantine**
- **N18 Compliance Extensibility + Data Governance**
- **N19 Merge Governance + Release Gates**
- **N20 Self-Hosting + Bootstrap Plan**

### Dependency Guidance
- N2 → N11, N12, N13, N14, N15, N17, N19, N20
- N3 → N11, N12, N13, N14, N15, N16, N17, N18, N19
- N4 → N16, N17 (driver behavior must support these)
- N5 → N12, N15 (env spec needs determinism + storage hooks)
- N6 → N13, N18 (policy/creds tie into trust + compliance)
- N7 → N11, N17, N19 (scheduler must enforce cost, failures, merge gates)
- N8 → N12, N18 (provenance supports replay + compliance)
- N11–N20 → N10 (marketplace hardening depends on all)

---

## Node Details: Tasks & Subtasks

### N11 — Economic Model + Cost Attribution
**Goal:** deterministic metering, quotas, and pricing primitives.

Tasks:
1. Define resource metering units:
   - CPU-seconds, memory-seconds, disk I/O, network egress, storage GB-hours
2. Define attribution scope:
   - tenant → project → swarm → run → step
3. Define quota model:
   - hard caps, soft caps, burst limits, daily/monthly budgets
4. Define enforcement points:
   - scheduler admission control, runtime kill switches
5. Define pricing tiers (internal first):
   - microVM default, optional cheaper tiers if supported

Deliverables:
- `spec/Economics.md`
- `spec/Contracts/Metering.schema.json`
- `packages/allternit-metering/*`

Acceptance:
- Every run has a cost record and enforceable budget constraints.

---

### N12 — Determinism Envelope + Replay Contract
**Goal:** define what can be replayed and what must be frozen or logged.

Tasks:
1. Define deterministic execution envelope:
   - env spec hash, tool versions, policy hash, inputs bundle
2. Define model determinism policy:
   - model id/version, temperature, seed policy (if applicable)
3. Define external I/O rules:
   - allowed domains, caching/proxy strategy, time-freezing rules
4. Define replay mechanism:
   - “replay run” recreates env + policy + inputs and re-executes steps
5. Define non-determinism capture:
   - timestamps, network responses, tool outputs recorded in receipts

Deliverables:
- `spec/Determinism_and_Replay.md`
- `spec/Contracts/ReplayReceipt.schema.json`
- `packages/allternit-replay/*`

Acceptance:
- “Replay this run” produces auditable parity within the defined envelope.

---

### N13 — Trust Model + Tenant Tiering
**Goal:** formalize trust classes and map them to isolation, policy, and capabilities.

Tasks:
1. Define tenant trust classes:
   - internal, partner, public marketplace
2. Define agent trust classes:
   - signed/verified, org-owned, unknown
3. Map trust → isolation tier:
   - microVM required for public; cheaper tiers optional for internal
4. Map trust → network privileges:
   - VPC access, internal services, internet egress
5. Define artifact publishing rules:
   - signed outputs, provenance required, quarantine pipeline

Deliverables:
- `spec/TrustModel.md`
- `spec/Contracts/TrustTier.schema.json`
- `packages/allternit-trust/*`

Acceptance:
- Clear rules that prevent cross-tenant data leakage and privilege drift.

---

### N14 — Versioning + Backwards Compatibility
**Goal:** prevent platform drift from breaking old agents and runs.

Tasks:
1. Define versioning scheme for:
   - env spec, driver interface, policy schema, scheduler semantics
2. Define compatibility policy:
   - minimum supported versions, deprecation windows
3. Add negotiation/handshake:
   - driver advertises capabilities and supported schema versions
4. Add migrations:
   - schema upconverters/downconverters where feasible
5. Add golden compatibility tests:
   - old runs replay under new platform within envelope

Deliverables:
- `spec/Versioning.md`
- `packages/allternit-versioning/*`
- `spec/AcceptanceTests.md` updates (compat tests)

Acceptance:
- Old artifacts/runs remain interpretable and replayable after upgrades.

---

### N15 — State Storage + Event/Run Ledger
**Goal:** define authoritative storage for runs, swarms, policies, receipts.

Tasks:
1. Define authoritative state model:
   - event-sourced ledger vs relational state machine (choose and justify)
2. Define entities:
   - tenant, project, workspace, run, step, artifact, policy, credential scope
3. Define retention policy:
   - logs/receipts retention, artifact lifetimes, deletion semantics
4. Define integrity:
   - hashes, signatures, append-only constraints for audit
5. Implement storage adapters:
   - local dev, single-node prod, distributed prod path

Deliverables:
- `spec/StateModel.md`
- `packages/allternit-ledger/*`
- `spec/Contracts/LedgerEvent.schema.json`

Acceptance:
- Immutable audit trail exists for all executed work.

---

### N16 — Prewarm + Cold Start Strategy
**Goal:** keep spawn latency predictable under load.

Tasks:
1. Define cold start budget targets:
   - spawn time SLA for interactive vs background runs
2. Define prewarm pool strategy:
   - pool sizes per tier, eviction rules, region placement
3. Define image caching strategy:
   - base images, layered caches, Nix binary cache integration (if used)
4. Define autoscaling policy:
   - queue depth, CPU pressure, budget constraints
5. Implement telemetry-driven scaling:
   - feedback loop from metering + scheduler

Deliverables:
- `spec/Prewarm_and_Scaling.md`
- `packages/allternit-prewarm/*`

Acceptance:
- Swarm spin-up meets targets without runaway idle spend.

---

### N17 — Failure Semantics + Quarantine
**Goal:** explicit failure taxonomy and containment rules.

Tasks:
1. Define failure taxonomy:
   - boot fail, dependency fail, test fail, hang, policy violation, suspected compromise
2. Define retry model:
   - which failures retry, max retries, backoff
3. Define quarantine pipeline:
   - suspected compromise isolates artifacts and blocks promotion
4. Define escalation hooks:
   - notify operator, require approval, auto-disable agent versions
5. Implement kill switches:
   - per run, per swarm, per tenant

Deliverables:
- `spec/FailureModel.md`
- `packages/allternit-failure/*`

Acceptance:
- Failures don’t cascade; compromised runs can’t silently ship.

---

### N18 — Compliance Extensibility + Data Governance
**Goal:** keep the architecture compatible with enterprise compliance requirements.

Tasks:
1. Define data classification:
   - PII, secrets, customer data, source code
2. Define access controls:
   - who can view receipts/artifacts, RBAC/ABAC model
3. Define encryption requirements:
   - at rest, in transit, key management hooks
4. Define locality controls:
   - region pinning, VPC residency, tenant-specific constraints
5. Define audit retention + export:
   - compliance exports, immutable logs

Deliverables:
- `spec/DataGovernance.md`
- `packages/allternit-governance/*`

Acceptance:
- No architectural dead-ends that prevent SOC2-style controls later.

---

### N19 — Merge Governance + Release Gates
**Goal:** prevent autonomous chaos; formalize merge requirements.

Tasks:
1. Define merge gates:
   - tests required, policy pass required, provenance required, signatures
2. Define reviewer model:
   - human-in-loop thresholds by trust tier
3. Define auto-merge policy:
   - risk scoring, file path sensitivity, blast radius estimation
4. Define PR provenance binding:
   - PR references receipts, env hash, policy hash, artifact checks
5. Implement merge arbiter:
   - final decision mechanism + override controls

Deliverables:
- `spec/MergeGovernance.md`
- `packages/allternit-merge-arbiter/*`

Acceptance:
- Every merge has evidence and a clear authority path.

---

### N20 — Self-Hosting + Bootstrap Plan
**Goal:** determine whether Allternit will run itself and how bootstrapping works.

Tasks:
1. Decide self-hosting scope:
   - control plane only vs full execution fabric
2. Define bootstrap sequence:
   - minimal base, then expand capabilities
3. Define recursion constraints:
   - avoid circular dependencies in deployment and updates
4. Define dogfooding plan:
   - Allternit agents manage parts of Allternit repo safely under gates
5. Define upgrade safety:
   - staged rollout, canary, rollback path

Deliverables:
- `spec/SelfHosting.md`
- `docs/BootSequence.md`

Acceptance:
- Clear, testable bootstrap that doesn’t deadlock platform evolution.

---

## Updated “Do Next” (revised)
1. Finish **N1 Repo Alignment Audit**
2. Produce **N2 Target Architecture Spec**
3. Finalize **N3 Driver Interface**
4. Implement **N11–N15** (economics/determinism/trust/versioning/state) in spec form before hardening N4
5. Choose and build **N4 Prototype Driver**
