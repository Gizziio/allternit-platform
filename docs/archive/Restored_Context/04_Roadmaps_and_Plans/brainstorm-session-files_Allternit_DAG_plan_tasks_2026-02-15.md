# A://TERNIT — DAG Plan & Task/Subtask List (2026-02-15)

This is a dependency-ordered DAG plan to implement the agent-first, multi-tenant execution fabric and supervisory platform.

---

## DAG Overview (nodes + dependencies)

**N0. North Star Freeze (Vision Lock)**
- Defines the product as an autonomous engineering compute fabric + governance layer.

**N1. Repo Alignment Audit**
- Output: current architecture mapped to the 3-layer model, plus a gap matrix.

**N2. Target Architecture Spec**
- Output: final 3-layer architecture, invariants, and contracts.

**N3. Execution Driver Interface (Core Contract)**
- Output: stable API that all substrates must implement.

**N4. Substrate Choice + Prototype Driver**
- Output: Kata-first or Firecracker-first driver with spawn/exec/destroy.

**N5. Environment Definition Layer**
- Output: devcontainer + optional Nix intake → normalized Allternit env spec.

**N6. Policy Engine + Credential Broker**
- Output: enforceable policy-as-code + ephemeral scoped credentials.

**N7. Swarm Scheduler + DAG Runtime**
- Output: deterministic orchestration, concurrency, retries, cancellation.

**N8. Provenance + Observability**
- Output: receipts, audit logs, traces, artifacts, replay.

**N9. Supervisory UX (Operator UI)**
- Output: dashboards + controls for swarms, policies, costs, replays.

**N10. Marketplace Hardening**
- Output: tenant isolation, quotas/billing, tiers, SLA, onboarding.

### Dependencies
- N0 → N1
- N1 → N2
- N2 → N3
- N3 → N4, N5, N6
- N4 + N5 + N6 → N7
- N7 → N8
- N8 → N9
- N9 → N10

---

## Node Details: Tasks & Subtasks

### N0 — North Star Freeze (Vision Lock)
**Goal:** remove ambiguity; everything aligns to agent-first execution fabric.

Tasks:
1. Write 1-page “A://TERNIT is …” definition.
2. Define non-goals (e.g., “not an IDE replacement”).
3. Define primary user roles:
   - tenant admin, reviewer, operator, agent (autonomous actor)

Deliverable:
- `docs/Vision_AgentFirst_ComputeFabric.md`

Acceptance:
- Explicit multi-tenant, untrusted execution stance.
- Explicit 3-layer architecture commitment.

---

### N1 — Repo Alignment Audit
**Goal:** discover current truth; map to the 3-layer model.

Tasks:
1. Map modules/packages to Layer 1/2/3.
2. Identify execution pathways:
   - where commands run, where state lives
3. Identify isolation assumptions:
   - WebVM coupling depth, Docker reliance
4. Identify secrets/credential handling:
   - local env vars, files, tokens, etc.
5. Identify policy enforcement points:
   - pre-tool, post-tool, kernel-level, none
6. Identify DAG/scheduler implementation status:
   - determinism, concurrency, retries/cancel
7. UI/UX posture assessment:
   - dev-first vs operator-first

Deliverables:
- `docs/Audit_3Layer_Map.md`
- `docs/Audit_Gap_Matrix.md`

Acceptance:
- Clear list of “implemented / partial / missing / incorrect abstractions”.

---

### N2 — Target Architecture Spec
**Goal:** define final intended architecture and invariants.

Tasks:
1. Specify Layer 1/2/3 responsibilities precisely.
2. Define tenant isolation model:
   - org → project → workspace → run
3. Define “Execution Unit” semantics:
   - ephemeral, destroyable, policy-bound
4. Define security invariants:
   - assume compromise; blast radius bounded
5. Define event + telemetry schemas:
   - run start/end, tool calls, artifacts, receipts

Deliverables:
- `spec/Architecture.md`
- `spec/SecurityModel.md`
- `spec/Telemetry.md`

Acceptance:
- No localhost assumptions.
- Multi-driver strategy defined.

---

### N3 — Execution Driver Interface (Core Contract)
**Goal:** stable contract between Rails and execution substrates.

Tasks:
1. Define driver methods:
   - `spawn(env, policy, creds, resources)`
   - `exec(cmd, timeout, io_limits)`
   - `stream_logs()`
   - `get_artifacts()`
   - `destroy()`
   - optional `snapshot/restore()`
2. Define inputs/outputs schemas:
   - JSON schema for env spec, policy, receipts
3. Define failure model:
   - timeouts, retries, partial artifacts
4. Define resource accounting model:
   - CPU/RAM/IO time tracked per run

Deliverables:
- `spec/Contracts/ExecutionDriver.schema.json`
- `packages/allternit-exec-driver` (trait/interface + reference types)

Acceptance:
- No substrate-specific fields leak into the control plane.

---

### N4 — Substrate Choice + Prototype Driver
**Goal:** pick baseline isolation and make it real.

Tasks (Kata-first path):
1. Choose orchestrator target (K8s or Nomad or custom).
2. Implement Kata driver:
   - spawn sandbox with OCI image
   - apply resource limits
   - network namespace policies
3. Implement teardown guarantees:
   - destroy-on-complete
   - idle reaping hooks

Tasks (Firecracker-first path):
1. Implement Firecracker VM manager:
   - image build, kernel/rootfs
   - microVM spawn pool (prewarm optional)
2. Attach networking + storage isolation
3. Implement command execution channel

Deliverables:
- `drivers/kata-driver/*` or `drivers/firecracker-driver/*`
- `docs/Driver_Substrate_Decision.md`

Acceptance:
- Can spawn N environments concurrently with hard isolation boundary.
- Deterministic lifecycle (boot → ready → run → teardown).

---

### N5 — Environment Definition Layer
**Goal:** repo-defined, portable environment specs.

Tasks:
1. Support Dev Containers intake (`devcontainer.json`):
   - parse → normalize
2. Optional Nix intake (flake):
   - parse/resolve → normalize
3. Define Allternit “normalized env spec”:
   - toolchain, deps, services, tasks, ports
4. Build lifecycle automation:
   - install deps, migrate db, start services, seed data
5. Add readiness checks:
   - “environment ready” probe + timeouts

Deliverables:
- `spec/Contracts/EnvironmentSpec.schema.json`
- `packages/allternit-env/*` (parser + normalizer)
- `docs/EnvSpec.md`

Acceptance:
- One repo config can produce identical environments across drivers.

---

### N6 — Policy Engine + Credential Broker
**Goal:** assume compromise; enforce constraints.

Tasks:
1. Policy-as-code:
   - allow/deny tool calls
   - network egress rules
   - file path restrictions
   - forbidden endpoints
2. Credential broker:
   - short-lived tokens
   - scoped to tenant/project/run
3. Enforcement points:
   - pre-exec checks in control plane
   - runtime enforcement hooks (driver-dependent)
4. Audit binding:
   - every run includes policy hash + credential scope id

Deliverables:
- `spec/Contracts/Policy.schema.json`
- `packages/allternit-policy/*`
- `packages/allternit-credentials/*`

Acceptance:
- No long-lived secrets inside sandboxes.
- Policy can hard-stop a run.

---

### N7 — Swarm Scheduler + DAG Runtime
**Goal:** deterministic orchestration and parallel work.

Tasks:
1. DAG executor:
   - topological scheduling
   - dependency gating
2. Swarm coordinator:
   - spawn N workers
   - shard tasks
   - aggregate results
3. Concurrency control:
   - global + tenant quotas
   - per-swarm caps
4. Cancellation/retry semantics:
   - idempotent restarts
5. Conflict arbitration:
   - file-level conflicts, PR merge strategy, “lead agent” decisions

Deliverables:
- `packages/allternit-scheduler/*`
- `packages/allternit-swarm/*`
- `docs/SwarmRuntime.md`

Acceptance:
- Parallel runs do not share mutable state.
- Deterministic behavior under fixed inputs.

---

### N8 — Provenance + Observability
**Goal:** enterprise-grade auditability and replay.

Tasks:
1. Receipts:
   - command history, tool calls, stdout/stderr
2. Artifact lineage:
   - tests, coverage, build outputs, patches
3. Replay:
   - rerun with same env spec + policy + inputs
4. Telemetry:
   - cost, latency, resource consumption, failure causes

Deliverables:
- `packages/allternit-provenance/*`
- `packages/allternit-observability/*`
- `docs/Replay_and_Receipts.md`

Acceptance:
- “Explain why this PR is safe to merge” is evidence-backed.

---

### N9 — Supervisory UX
**Goal:** UI optimized for governance, not coding.

Tasks:
1. Swarm dashboard:
   - status, queue, worker count, progress
2. Policy editor + policy simulator:
   - “what would be blocked”
3. Cost + quota dashboards:
   - per tenant/project/run
4. Replay UI:
   - rerun, diff receipts, compare artifacts
5. Exception handling:
   - approve/deny gates, manual override

Deliverables:
- `apps/shell` UX updates
- `docs/Supervisory_UX_Principles.md`

Acceptance:
- Operators can manage swarms without touching code.

---

### N10 — Marketplace Hardening
**Goal:** production standard multi-tenant platform.

Tasks:
1. Tenant onboarding:
   - org, billing, quotas, policies
2. Tiered isolation modes:
   - microVM default, gVisor/WASM tiers optional
3. Abuse prevention:
   - rate limits, egress blocks, anomaly detection
4. SLA + reliability:
   - prewarm pools, autoscaling, retries
5. Marketplace packaging:
   - agent bundles, verified capabilities, signed artifacts

Deliverables:
- `docs/Marketplace_Model.md`
- `docs/Security_and_Tiers.md`

Acceptance:
- External tenants run safely with bounded blast radius.

---

## Immediate “Do Next” Checklist (start here)
1. Complete **N1 Repo Alignment Audit**
2. Produce **N2 Target Architecture Spec**
3. Finalize **N3 Driver Interface**
4. Choose substrate path and begin **N4 Prototype Driver**
