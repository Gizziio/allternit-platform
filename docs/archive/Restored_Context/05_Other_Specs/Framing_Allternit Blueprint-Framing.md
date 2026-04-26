Viable at scale: yes, if you implement it as a contract surface + optional daemon backends, not “spawn 50 binaries per minute forever.”

What you’re locking in is a topology that is structurally aligned with swarms/orchestration because it turns the platform into a set of typed capabilities with deterministic IO, policy gates, artifact provenance, and version enforcement. Those are exactly the properties swarms need to avoid chaos.

Why this topology scales with agent swarms

Agent swarms fail for predictable reasons:
	•	agents can’t reliably call tools (unstable output, unclear errors)
	•	tools can’t be composed (no shared artifact model)
	•	side effects aren’t controlled (no single-writer, no policy)
	•	reproducibility is missing (no run logs, no provenance, no fixtures)
	•	drift accumulates (no compatibility enforcement)

Your layered CLIs, if done correctly, solve those at the boundary:
	•	Each layer = a capability module (runtime, memory, browser, skills, artifacts, policy, repo cartography)
	•	Contracts = the swarm’s “physics” (what is callable, what is returned, what is denied)
	•	Artifacts = the swarm’s shared substrate (every step yields stable IDs; workflows are traceable and replayable)
	•	Doctor + CI = drift prevention (swarms are useless if the toolchain is non-deterministic)

The only real scalability risk: process overhead + coordination overhead

At scale, “CLI as the only execution mode” is the trap.

If 200 agents are calling tools continuously, pure process spawning can become:
	•	expensive (fork/exec overhead)
	•	noisy (log storms)
	•	brittle (concurrency + file locks)
	•	harder to stream (long tasks)

The fix is the hybrid that your blueprint already implies:
	•	CLIs are the stable interface
	•	hot paths run via daemon mode / library mode
	•	the CLI becomes a thin client to the daemon when throughput matters

So the scalable form is:
	•	Interface layer: CLI contract (schemas, exit codes, artifacts)
	•	Execution layer: daemon services (long-lived, pooled, concurrent)
	•	Routing layer: a2 dispatch + workflow runner
	•	Orchestration layer: swarms call the same tool surfaces, get the same artifacts

When this is a bad idea

It’s a bad idea if you violate any of these:
	•	Router starts implementing domain logic (new monolith)
	•	Two layers write the same state (race conditions + corruption)
	•	No schema enforcement (agents end up “prompt-parsing” output)
	•	UI bypasses tools (invariants split, policies bypassed)
	•	No compatibility checks (swarms amplify drift into failure)

What “good at scale” looks like (operationally)

If you want this topology to be swarm-ready, you need these scale primitives:
	1.	Daemon mode for high-frequency layers

	•	runtime, browser, memory, artifact store typically need long-lived processes

	2.	Artifact store is mandatory, not optional

	•	every step returns artifact IDs, not blobs

	3.	Strict tool contracts are enforced in CI

	•	schema validation + golden fixtures + doctor must fail when broken

	4.	Concurrency controls

	•	single-writer rules + locks + idempotent commands

	5.	Observability as first-class artifacts

	•	every run emits structured logs + traces as artifacts

	6.	Compatibility matrix

	•	contract versions pinned; swarms can’t tolerate silent drift

Session saved

I saved this session as an Allternit session summary using the blueprint framing (Layered CLI topology) and linked it to the two canonical docs you generated in canvas. 
Below are the two documents line 82 and line 458

# Allternit — Layered CLI Implementation Blueprint

> Goal: implement a modular, contract-driven CLI layer system with a thin router, artifact-first IO, workflow runner, compatibility enforcement, and CI gates.

---

## 1) Target End-State

### 1.1 Runtime Topology

* **Tier 1 (Domain CLIs):** `a2-runtime`, `a2-memory`, `a2-skill`, `a2-artifact`, `a2-browser`, `a2-policy`, `a2-repo`
* **Tier 2 (Router):** `a2` dispatches commands + runs workflows
* **Tier 3 (UI/Agents):** call `a2 …` (or daemon APIs where needed), never re-implement logic

### 1.2 Non-Negotiable Guarantees

* Every tool returns **stable JSON envelopes** (`--json`) and **stable exit codes**.
* All cross-layer data is passed as **Artifact IDs** (artifact-first IO).
* Version drift is detected by `a2 doctor` and blocked by CI when incompatible.
* Policy gates exist at the boundary (policy can deny actions deterministically).

---

## 2) Build Order (Do This In This Sequence)

### Phase 0 — Decide Boundaries (1 session)

**Deliverables**

1. `docs/layers/LAYER_BOUNDARIES.md`
2. `docs/layers/LAYER_OWNERSHIP.md`

**Tasks**

* T0.1: List candidate domains and map state ownership.
* T0.2: Merge/split until each layer has **exclusive write ownership** over its state.
* T0.3: Declare prohibited overlaps (ex: UI cannot persist memory; router cannot mutate memory).

**Acceptance**

* For every stateful entity: exactly one writer layer.

**Pitfalls to avoid**

* Splitting by “features” instead of “state ownership”.
* Allowing two tools to mutate the same state.

---

### Phase 1 — Standard CLI Contract (the foundation)

**Deliverables**

1. `/spec/Contracts/cli-output.schema.json`
2. `/spec/Contracts/artifact.schema.json`
3. `docs/cli/EXIT_CODES.md`
4. `docs/cli/CLI_STANDARD.md`

**Tasks**

* T1.1: Define JSON envelope fields (schema_version, tool, command, status, exit_code, artifacts, result, logs, timings).
* T1.2: Define exit codes (0/1/2/3/4 as minimum).
* T1.3: Define log format (structured, machine parsable, with event ids).
* T1.4: Define `doctor` and `version` outputs.
* T1.5: Create a tiny validator script used by CI to validate sample outputs against schema.

**Acceptance**

* Any tool output can be validated by `cli-output.schema.json`.
* Exit codes are consistent across tools.

**Pitfalls**

* “JSON output” without schemas (breaks automation).
* Mixing human text and JSON in the same stream.

---

### Phase 2 — Artifact Store + Artifact-first IO

**Deliverables**

1. `/spec/Contracts/artifact.schema.json` (final)
2. `services/state/artifacts/*` (or your canonical location)
3. `a2-artifact` CLI (minimal)

**Tasks**

* T2.1: Implement artifact registry: create, get, list, metadata update.
* T2.2: Enforce content hashing (sha256) + type tagging.
* T2.3: Implement `a2-artifact add`, `get`, `list`, `render/export` (stub render is OK early).
* T2.4: Update other CLIs to return `artifacts:[{id,type,…}]` rather than raw blobs.

**Acceptance**

* Every non-trivial output is an artifact (snapshots, logs, tables, previews, diffs).

**Pitfalls**

* Allowing tools to pass untracked blobs directly (loses provenance).
* Artifact IDs without durability (must persist).

---

### Phase 3 — Two Domain CLIs to Prove the Pattern

Pick **two** layers first, ideally:

* `a2-runtime` (spawning/attaching/runtimes) and
* `a2-memory` (store/retrieve/compact)

**Deliverables**

1. `a2-runtime` CLI with `list/get/doctor/version`
2. `a2-memory` CLI with `store/retrieve/compact/doctor/version`
3. `/spec/Layers/runtime/*` and `/spec/Layers/memory/*`

**Tasks**

* T3.1: Implement `--json` everywhere.
* T3.2: Implement deterministic error mapping to exit codes.
* T3.3: Emit artifacts for every meaningful result.
* T3.4: Add per-layer AcceptanceTests.md (even if minimal).

**Acceptance**

* Two tools fully comply with the CLI standard + artifacts.

**Pitfalls**

* Overbuilding features before contracts are stable.
* Letting “temporary” output formats ship.

---

### Phase 4 — Router CLI (`a2`) as Thin Dispatch

**Deliverables**

1. `a2` router binary
2. `docs/cli/ROUTER_RULES.md`

**Tasks**

* T4.1: Implement command discovery (`a2 --list-tools`).
* T4.2: Implement dispatch (`a2 memory retrieve …` -> `a2-memory retrieve …`).
* T4.3: Aggregate help (`a2 help memory`).
* T4.4: Normalize global flags: `--json`, `--quiet`, `--trace`, `--workspace`, `--profile`.

**Acceptance**

* Users can live inside `a2` without learning all binaries.

**Pitfalls**

* Router starts implementing business logic.
* Router rewrites outputs instead of passing through.

---

### Phase 5 — Compatibility Matrix + Doctor Enforcement

**Deliverables**

1. `docs/cli/COMPATIBILITY.md`
2. `a2 doctor` aggregates layer checks
3. CI job: `compat_check`

**Tasks**

* T5.1: Define contract version constraints per tool.
* T5.2: `a2 doctor` collects `a2-<layer> doctor` outputs.
* T5.3: Fail doctor if any layer is incompatible.
* T5.4: CI runs doctor on every build.

**Acceptance**

* Version drift is caught before release.

**Pitfalls**

* “Best effort” doctor that never fails.
* Tools reporting versions without contract versions.

---

### Phase 6 — Policy Gate as a First-Class Layer

**Deliverables**

1. `a2-policy` with `evaluate` and `enforce`
2. `/agent/POLICY.md` integration path

**Tasks**

* T6.1: Implement policy decision API: (actor, tool, command, target) -> allow/deny + reason.
* T6.2: Update each layer to call policy before destructive operations.
* T6.3: Standardize “policy denied” exit code = 3.
* T6.4: Log policy decisions as artifacts.

**Acceptance**

* A forbidden operation reliably fails with exit code 3 and machine-readable denial.

**Pitfalls**

* Policy implemented only in UI.
* Policy returning human prose without machine fields.

---

### Phase 7 — Workflow Runner (Compositional Orchestration)

**Deliverables**

1. `a2 run workflow.yaml`
2. `/spec/Contracts/workflow.schema.json` (minimal)

**Tasks**

* T7.1: Define workflow spec: steps, env, artifact bindings.
* T7.2: Implement step execution by calling `a2 …` commands.
* T7.3: Store workflow run logs as artifacts.
* T7.4: Add retry policies and deterministic failure behavior.

**Acceptance**

* End-to-end flows are reproducible from YAML.

**Pitfalls**

* Workflow runner becomes a second orchestrator with hidden logic.
* Non-deterministic retries without logging.

---

### Phase 8 — UI Integration Rules (so UI stays honest)

**Deliverables**

1. `docs/ui/NO_UI_LOGIC.md`
2. UI adapter layer: one place that calls `a2` or daemon APIs

**Tasks**

* T8.1: Identify UI features that currently implement business logic.
* T8.2: Replace with calls to `a2`.
* T8.3: Ensure UI can run in “headless validation mode” (E2E tests call CLIs directly).

**Acceptance**

* UI is a client; all invariants are enforced by CLIs/policy/contracts.

**Pitfalls**

* UI-only features that bypass policy and artifacts.

---

### Phase 9 — Packaging & Distribution

**Deliverables**

1. `docs/release/DISTRIBUTION.md`
2. bundle manifest containing exact tool versions

**Tasks**

* T9.1: Decide: single installer shipping multiple binaries.
* T9.2: Include manifest (`tools.json`) listing binaries + contract versions.
* T9.3: `a2 doctor` verifies manifest matches installed binaries.

**Pitfalls**

* Tools installed ad hoc without a manifest.

---

## 3) “Other Things Suggested” — Concrete Tasks

### 3.1 Convert Architecture to SOT + ADRs

**Deliverables**

* `/SOT.md` references layered CLI architecture and points to specs
* `/spec/ADRs/ADR-001-layered-cli.md` (pivot decision)

**Tasks**

* S1: Create ADR: context, decision, alternatives, consequences.
* S2: Update SOT to list CLIs as platform primitives.

**Pitfalls**

* Architecture lives only in chat/docs without being SOT-linked.

---

### 3.2 Per-Layer Acceptance Tests (Executable Matrix)

**Deliverables**

* `/spec/Layers/<layer>/AcceptanceTests.md`

**Tasks**

* AT1: Define “golden tests” for each command (inputs, expected JSON envelope, expected artifacts).
* AT2: Add a test runner that executes commands and validates JSON schema.

**Pitfalls**

* Tests validate only “exit 0” and not schema/artifacts.

---

### 3.3 CI Gates

**Deliverables**

* CI jobs:

  * `schema_validate`
  * `doctor`
  * `acceptance_tests`

**Pitfalls**

* CI doesn’t enforce contract drift.

---

## 4) High-Probability Pitfalls (Top 12)

1. **Router becomes the new monolith**
2. **Two layers write the same state**
3. **No real schema validation in CI**
4. **Human-only output sneaks in**
5. **Artifacts exist but aren’t used as IO**
6. **Policy lives in UI instead of tools**
7. **Version strings without contract versions**
8. **Doctor never fails**
9. **Workflow runner embeds hidden logic**
10. **UI bypass paths for speed**
11. **Inconsistent global flags and config**
12. **Too many layers too early (complexity spike)**

---

## 5) “Definition of Done” Checklist

A2 layered CLI system is working when:

* [ ] All layer CLIs implement `--json`, `doctor`, `version`
* [ ] All outputs validate against `/spec/Contracts/cli-output.schema.json`
* [ ] All meaningful outputs are artifacts, referenced by ID
* [ ] `a2` router dispatches without implementing logic
* [ ] `a2 doctor` fails on incompatibility
* [ ] CI blocks schema drift and version drift
* [ ] Policy gates destructive actions with exit code 3
* [ ] Workflows run from YAML and produce auditable artifacts
* [ ] UI calls CLIs/APIs and does not own invariants

---

## 6) Minimum Viable Implementation (MVI) Path

If you want the fastest proof:

1. Phase 1 (CLI contract)
2. Phase 2 (artifact store)
3. Phase 3 (runtime + memory)
4. Phase 4 (router)
5. Phase 5 (doctor + CI)

Everything else builds safely after that.

# Allternit — Layered CLI Platform Architecture

> Single Source of Truth Draft — Layered Toolchain Model

---

## 0. Purpose

This document captures the architectural direction discussed in this thread:

* Why **modular CLIs as platform layers** outperform a single mega‑CLI.
* The trade‑offs and failure modes.
* The exact system being designed.
* A formal **Layered CLI Platform Spec**.
* A canonical **/spec folder skeleton**.
* A minimal **CLI Contract Schema** enforceable in CI.

Allternit is converging toward:

> **An OS‑like agent platform composed of composable, versioned CLI layers bound by strict contracts and orchestrated by a thin router.**

---

## 1. Problem Statement

A monolithic CLI/TUI tends to become:

* Tightly coupled
* Hard to test
* Hard to secure
* Slow to evolve
* Brittle under agent automation

The emerging requirement is:

* Parallel agent development
* Strong law/contract enforcement
* UI as a thin client
* Artifact‑first workflows
* Deterministic, testable execution

This drives a **layered toolchain** rather than a single executable.

---

## 2. Core Insight

You are transitioning from:

> **"One platform binary"**

To:

> **"Many domain CLIs + strict interfaces + orchestration"**

Where:

* Each CLI owns one domain.
* The platform is the *composition* of those CLIs.
* The UI and agents call the same interfaces.
* Contracts are the real system boundary.

---

## 3. Benefits of Layered CLIs

### 3.1 Architecture

* Clear bounded contexts
* Replaceable subsystems
* Parallel development
* Independent release cycles

### 3.2 Testing

* Smaller blast radius
* Composable E2E flows
* Deterministic automation

### 3.3 Security

* Per‑tool permissions
* Policy gating
* Auditable actions

### 3.4 Velocity

* Faster iteration
* Plugin ecosystems
* Agent‑friendly

---

## 4. Risks & Mitigations

| Risk                     | Description           | Mitigation                      |
| ------------------------ | --------------------- | ------------------------------- |
| UX Fragmentation         | Too many CLIs         | Thin router `a2`                |
| Version Drift            | Contracts break       | Compatibility matrix + `doctor` |
| Duplication              | Logging/auth repeated | Shared SDK                      |
| Performance              | Process spawn cost    | Daemons + libraries             |
| Orchestration Complexity | Brittle flows         | Workflow runner                 |

---

## 5. Four‑Tier Model

### Tier 0 — Law & Truth

* `/SOT.md`
* `/spec/*`
* `/spec/Contracts/*`
* `/agent/POLICY.md`
* `/spec/AcceptanceTests.md`

### Tier 1 — Domain CLIs

Each owns one slice of reality:

* `a2-runtime`
* `a2-memory`
* `a2-skill`
* `a2-artifact`
* `a2-browser`
* `a2-policy`
* `a2-repo`

### Tier 2 — Router

* `a2 <noun> <verb>`
* Dispatch only
* No business logic

### Tier 3 — UI / Agents

* UI never implements logic
* Agents use same interfaces

---

# PART A — Layered CLI Platform Spec

---

## A1. Design Principles

1. Contracts > Code
2. Layers are bounded
3. Router is thin
4. UI is a client
5. Artifacts are IO
6. Everything testable
7. Everything versioned

---

## A2. Layer Responsibilities

| Layer    | Domain                   |
| -------- | ------------------------ |
| runtime  | spawn / attach / PTY     |
| memory   | persistence / compaction |
| skill    | install / sandbox        |
| artifact | render / export          |
| browser  | automation               |
| policy   | allow/deny               |
| repo     | cartography              |

---

## A3. CLI Behavioral Contract

Every layer must:

* Support `--json`
* Emit schema versions
* Deterministic exit codes
* Structured logs
* `doctor`
* `version`

---

## A4. Artifact‑First IO

No raw pipes for complex flows.

Artifacts have:

* ID
* type
* producing tool
* hashes
* timestamps
* metadata

---

## A5. Router Responsibilities (`a2`)

* Discover installed layers
* Aggregate help
* Dispatch commands
* Run workflows
* Version validation

---

## A6. Workflow Runner

Declarative runs:

```yaml
steps:
  - run: a2-browser snapshot
  - run: a2-memory store
  - run: a2-artifact render
```

---

# PART B — Canonical /spec Folder Skeleton

---

```text
/spec
  /baseline
    Vision.md
    Requirements.md
    Architecture.md

  /Layers
    /runtime
      Requirements.md
      Contracts
      AcceptanceTests.md

    /memory
      Requirements.md
      Contracts
      AcceptanceTests.md

    /artifact
      Requirements.md
      Contracts
      AcceptanceTests.md

    /browser
      Requirements.md
      Contracts
      AcceptanceTests.md

    /policy
      Requirements.md
      Contracts
      AcceptanceTests.md

    /repo
      Requirements.md
      Contracts
      AcceptanceTests.md

  /Contracts
    cli-output.schema.json
    artifact.schema.json

  /Deltas

/agent
  POLICY.md

/SOT.md
```

---

# PART C — Minimal CLI Contract Schema

---

## C1. Output Envelope

```json
{
  "schema_version": "1.0",
  "tool": "a2-memory",
  "command": "retrieve",
  "status": "ok",
  "exit_code": 0,
  "artifacts": [],
  "result": {},
  "logs": []
}
```

---

## C2. Exit Codes

| Code | Meaning            |
| ---- | ------------------ |
| 0    | Success            |
| 1    | User Error         |
| 2    | System Failure     |
| 3    | Policy Denied      |
| 4    | Contract Violation |

---

## C3. Artifact Schema

```json
{
  "id": "art_123",
  "type": "snapshot",
  "origin_tool": "a2-browser",
  "sha256": "...",
  "created_at": "2026-01-25T12:00:00Z",
  "metadata": {}
}
```

---

## C4. Doctor Contract

`a2-<layer> doctor` returns:

```json
{
  "schema_version": "1.0",
  "healthy": true,
  "checks": []
}
```

---

# PART D — Governing Principle

> Put behavior in layers.
> Put coordination in the orchestrator.
> Put truth in contracts.
> Put UI last.

---

# PART E — Implementation Blueprint

---

This section converts the architecture into an executable rollout plan.

## E1. Phase Map

### Phase 0 — Freeze the Law

**Tasks**

* Create `/SOT.md` entry: "Layered CLI Pivot".
* Add ADR: `ADR-001-layered-cli.md`.
* Lock Tier‑0 files as read‑only via CI.

**Exit Criteria**

* CI blocks merges without contract updates.
* Router cannot ship without pinned layer versions.

---

### Phase 1 — CLI Contract Foundation

**Tasks**

* Implement JSON envelope schema.
* Implement artifact schema.
* Implement exit‑code spec.
* Add validation library shared by all CLIs.
* Generate golden fixtures.

**Deliverables**

* `/spec/Contracts/cli-output.schema.json`
* `/spec/Contracts/artifact.schema.json`
* `lib/a2-cli-contract`

---

### Phase 2 — Router (`a2`) Skeleton

**Tasks**

* Command discovery (`PATH` scan or manifest registry).
* `a2 doctor` cross‑layer compatibility check.
* Passthrough execution.
* Help aggregation.
* Version pinning.

**Deliverables**

* `cmd/a2`
* `compatibility.json`

---

### Phase 3 — First Two Domain Layers

Build only:

* `a2-runtime`
* `a2-memory`

**Tasks**

* Implement doctor.
* Implement version.
* Wrap daemon mode.
* Add AcceptanceTests.md.
* Emit artifacts.

**Exit Criteria**

* UI runs exclusively through these CLIs.

---

### Phase 4 — Artifact Store

**Tasks**

* Artifact registry DB.
* Hashing.
* Retention rules.
* Provenance chain.

---

### Phase 5 — Workflow Runner

**Tasks**

* YAML DSL.
* Artifact wiring.
* Failure recovery.
* Policy hooks.

---

### Phase 6 — UI Migration

**Tasks**

* Remove logic from UI.
* Replace with CLI/API calls.
* Add playback from artifacts.

---

# PART F — Task Breakdown (Executable)

---

## F1. Repo Setup

* [ ] Add `/spec/Layers/*`
* [ ] Add `/spec/Contracts`
* [ ] Add `/agent/POLICY.md`
* [ ] Add `/adr/ADR-001-layered-cli.md`

---

## F2. CI Gates

* [ ] Validate JSON outputs
* [ ] Enforce exit codes
* [ ] Require AcceptanceTests
* [ ] Router compatibility check

---

## F3. Router

* [ ] Binary registry
* [ ] `a2 <layer> <cmd>` mapping
* [ ] Structured stderr/stdout
* [ ] Telemetry

---

## F4. Layer Template

Every new CLI must ship:

* main binary
* doctor
* version
* spec docs
* contracts
* tests

---

# PART G — Pitfalls & Failure Modes

---

## G1. Re‑monolithization

**Smell**: Router accumulates logic.

**Fix**: Only dispatch + workflows.

---

## G2. Contract Drift

**Smell**: Layers parse each other’s raw output.

**Fix**: Strict schema validation.

---

## G3. UI Logic Leak

**Smell**: UI bypasses CLIs.

**Fix**: Kill direct service calls.

---

## G4. State Duplication

**Smell**: Two layers mutate same DB.

**Fix**: Single writer law.

---

## G5. Version Explosion

**Smell**: Binary mismatch.

**Fix**: Bundle manifest + doctor.

---

## G6. Slow Pipelines

**Smell**: Fork storms.

**Fix**: Daemon mode.

---

# PART H — Enforcement Rules

---

1. No UI business logic.
2. No cross‑layer DB writes.
3. No undocumented outputs.
4. No router logic.
5. No skipping AcceptanceTests.

---

# PART I — Scalability & Agent‑Swarm Viability

---

This section evaluates whether the layered‑CLI topology is **sound at large scale** and **appropriate for multi‑agent swarms and orchestration**, and what must exist for it to hold.

## I1. Is This Viable at Scale?

### Verdict

**Yes — provided that:**

* CLIs are dual‑mode (CLI + long‑running daemon API).
* Contracts are enforced in CI and runtime.
* Artifact store and scheduler are centralized services.
* Router remains thin.

This topology mirrors patterns used in:

* Unix‑style composable systems
* Kubernetes control planes
* Bazel / Buck style build graphs
* Cloud provider control CLIs backed by APIs

The CLI is the **control surface**, not the execution engine.

---

## I2. Why This Works for Agent Swarms

Agent swarms require:

| Requirement        | Layered CLI Benefit                |
| ------------------ | ---------------------------------- |
| Parallel execution | Separate tools spawn independently |
| Deterministic IO   | Artifact‑first contracts           |
| Planning / DAGs    | Workflow runner                    |
| Auditability       | Logs + artifacts                   |
| Safety             | Policy layer                       |
| Replay             | Artifact provenance                |
| Isolation          | Per‑tool sandboxes                 |

Swarms do not want UI primitives — they want **stable verbs**.

Each CLI becomes an **actor primitive** in orchestration graphs.

---

## I3. Control Plane vs Data Plane

At scale, split:

### Control Plane

* Router (`a2`)
* Workflow engine
* Policy evaluation
* Scheduling
* Version enforcement

### Data Plane

* Runtime daemons
* Memory engines
* Browser automation workers
* Artifact store

CLIs front the control plane; daemons execute the data plane.

---

## I4. Swarm Topology

Typical swarm run:

1. Planner agent emits workflow YAML.
2. `a2 run` compiles DAG.
3. Scheduler fans out steps.
4. Domain daemons execute.
5. Artifacts recorded.
6. Critic agents read artifacts.
7. Fix‑up workflows spawned.

This supports:

* tree search
* debate
* verifier loops
* Ralph‑style reverse engineering
* long‑running research swarms

---

## I5. Throughput & Performance Requirements

For 100–10k agent tasks concurrently:

### Mandatory

* gRPC/HTTP daemon mode
* connection pooling
* async artifact writes
* distributed scheduler
* work queues
* idempotent commands

### Forbidden at scale

* fork‑per‑step execution
* stdout blob passing
* synchronous UI blocking

---

## I6. Versioning at Swarm Scale

Each task run must pin:

* tool binary hash
* contract version
* policy version
* workflow spec version

Recorded in artifact metadata.

This enables:

* full replay
* regression diffing
* forensic audits

---

## I7. Failure Domains

Layering gives **blast‑radius isolation**:

* browser crash ≠ memory corruption
* runtime overload ≠ router failure
* skill exploit ≠ policy bypass

Scheduler reroutes failed nodes.

---

## I8. New Pitfalls Introduced by Swarms

1. Scheduler becomes bottleneck
2. Artifact store overload
3. Contract evolution churn
4. Hidden side channels bypassing artifacts
5. Tool daemons drifting from CLI wrappers

### Mitigations

* horizontal scheduler scaling
* sharded artifact DB
* contract version negotiation
* mandatory artifact IDs
* daemon/CLI shared core libs

---

## I9. Comparison to Monolithic Platforms

| Aspect         | Monolith | Layered CLI |
| -------------- | -------- | ----------- |
| Scale teams    | Poor     | Excellent   |
| Agent swarms   | Brittle  | Native      |
| Safety         | Mixed    | Enforceable |
| Replaceability | Low      | High        |
| Replayability  | Weak     | Strong      |
| Ecosystem      | Closed   | Open        |

---

## I10. Strategic Conclusion

This topology is **specifically well‑suited** for:

* autonomous research labs
* coding swarms
* security analysis clusters
* agent marketplaces
* simulation environments

It is inferior only when:

* latency must be microseconds
* everything must run in‑process

For Allternit’s goal — **agent‑native OS with swarm orchestration** — this is a first‑principles‑aligned architecture.

---

# Status

Blueprint + scalability analysis complete. Canonical Allternit direction recorded.
