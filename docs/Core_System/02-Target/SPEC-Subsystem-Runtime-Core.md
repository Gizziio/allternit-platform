# /spec/layers/runtime-core/FullSpec.md
# Allternit Runtime Core Specification
## Sessions, Scheduler, Eventing, Artifacts, Checkpoints, Replay

Status: Canonical  
Layer: L1 Core Runtime (Sovereign Kernel)  
Scope: Every run, every workflow, every skill invocation

---

## 1. Purpose

`runtime-core` is the sovereign execution substrate of Allternit.

It provides:
- session lifecycle
- deterministic scheduling
- event emission
- artifact storage
- checkpoints
- replay drivers

It does **not** decide permissions (policy) and does **not** run side effects (tool gateway).

---

## 2. Core Responsibilities

### 2.1 Session System
- create/close sessions
- store session metadata
- bind tenant + identity + role
- correlate all downstream events/artifacts

### 2.2 Scheduler
- dispatch tasks from TaskQueue
- enforce concurrency caps
- enforce deadlines + TTL
- coordinate retries/backoff

### 2.3 Eventing Backbone
- emit lifecycle events to Event Bus
- attach trace IDs
- provide deterministic ordering per session where possible

### 2.4 Artifacts + Checkpoints
- store immutable artifacts
- content-address artifacts by hash
- create checkpoints at phase boundaries
- support rollback to last checkpoint

### 2.5 Replay Driver
- rehydrate context bundles + artifacts
- re-drive tasks in recorded order
- enforce side-effect blocking unless replay permits
- detect divergence

---

## 3. Session Model

### 3.1 Session Fields
- session_id
- tenant_id
- created_by (identity)
- role
- start_time
- end_time
- mode: `live | replay | sim`
- environment: `dev | stage | prod`
- embodiment: `none | sim | real`
- policy_snapshot_ref
- active_workflows[]

### 3.2 Session Guarantees
- all work is attributable to a session
- session is the root correlation ID
- session termination triggers safe stop handlers

---

## 4. Scheduling Model

### 4.1 Task Types
- workflow node tasks
- hook tasks (non-side-effect)
- verification tasks
- meta evaluation tasks

### 4.2 Scheduling Rules
- at-least-once delivery
- idempotency required for side effects (enforced by tool gateway)
- retry policies per task/node
- priority and deadline aware

### 4.3 Concurrency Controls
- per-tenant quotas
- per-session caps
- per-workflow caps
- per-skill caps

---

## 5. Eventing Model

### 5.1 Event Guarantees
- every phase transition emits an event
- every task dispatch emits an event
- every stop condition emits Stop

### 5.2 Ordering
- ordered per session where feasible
- unordered across sessions

### 5.3 Trace Propagation
- trace_id present in all tasks/events/artifacts

---

## 6. Artifacts

### 6.1 Artifact Properties
- immutable once created
- content-addressed
- includes metadata:
  - created_by
  - created_at
  - media_type
  - hash
  - size

### 6.2 Artifact Types
- plans
- diffs
- reports
- context bundles
- tool IO captures
- simulation results
- evaluation metrics

Artifacts are referenced everywhere by pointer.

---

## 7. Checkpoints

### 7.1 Checkpoint Triggers
- end of each workflow phase
- before any EXECUTE phase begins
- before any promotion/commit action

### 7.2 Checkpoint Content
- artifact pointers
- task queue offsets (if needed)
- workflow state snapshot
- policy decision snapshot refs

### 7.3 Rollback
Rollback reverts:
- workflow state to last checkpoint
- artifacts remain immutable (rollback uses pointers)
- any mutable external state rollback is delegated to registry/tool gateway/device layer

---

## 8. Stop / Termination Semantics

Stop conditions:
- user stop
- policy deny
- safety violation
- deadline exceeded
- repeated failure threshold
- emergency stop (embodiment)

On Stop:
- emit Stop event
- trigger hook cleanup
- flush ledger writes
- close session if configured

---

## 9. Integration Contracts

### 9.1 Policy
- runtime attaches policy snapshots to sessions
- runtime must not allow any tool execution without policy gating (enforced in tool gateway)

### 9.2 Messaging
- runtime consumes TaskQueue
- runtime emits to EventBus

### 9.3 Workflows
- runtime dispatches workflow tasks
- runtime checkpoints phase boundaries

### 9.4 History/UOCS
- runtime ensures events/artifacts are mirrored into history streams

---

## 10. Deployment Modes

### 10.1 Monolith Mode
All packages run in one process; boundaries remain contractual.

### 10.2 Compose / Services Mode
runtime-core runs as a service; messaging/workflows/tool gateway/policy may be separate processes.

### 10.3 Edge Mode
runtime-core runs locally on device hub; federation is optional and never authoritative.

---

## 11. Acceptance Criteria

A valid runtime-core must:
1) create a session and bind identity + tenant
2) dispatch tasks with retries and deadlines
3) emit lifecycle events with trace IDs
4) store immutable artifacts by hash
5) checkpoint at phase boundaries
6) replay a recorded session deterministically
7) stop safely under violation conditions

---

End of Runtime Core Specification
