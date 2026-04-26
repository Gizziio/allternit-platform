# Allternit SYSTEM LAW
## Constitutional Authority for Agentic Operating System

**Version:** 2.0.0  
**Status:** TIER-0 AUTHORITY  
**Effective:** 2026-02-20  
**Supersedes:** All prior LAW documents

**Name Change:** This document was previously "PROJECT_LAW.md". Renamed to "SYSTEM_LAW.md" to reflect system-wide constitutional authority, not project-specific governance.

---

## PREAMBLE

This document defines the constitutional law of Allternit.

It governs:
- How work is allowed to happen
- How agents behave
- How projects are structured
- How systems evolve over time
- How knowledge is preserved and enforced
- How failures are handled
- How time and state are managed

If any output, code, plan, or agent action conflicts with this document, **this document wins**.

---

## PART I: GUARDRAILS

### LAW-GRD-001 (HARD) — No Silent Assumptions

No agent or human may assume:
- Requirements
- Intent
- Constraints
- Permissions

All assumptions must be explicitly stated or derived from a spec.

**Enforcement:** WIH header validation, context pack requirements

---

### LAW-GRD-002 (HARD) — No Silent State Mutation

No system may:
- Mutate state
- Learn
- Summarize
- Optimize

Without producing an explicit artifact or record.

**Enforcement:** Receipt emission, evidence artifacts, journal entries

---

### LAW-GRD-003 (HARD) — No Backwards Compatibility by Default

Breaking changes are allowed and encouraged if they improve clarity or correctness.

Backwards compatibility must be explicitly justified, never assumed.

**Enforcement:** ADR requirements, delta documentation

---

### LAW-GRD-004 (HARD) — Plan ≠ Execute

Planning, reasoning, and execution are separate phases.

No execution may occur inside:
- Planning
- Exploration
- Discussion
- UI drafting

**Enforcement:** State machine gates, role isolation

---

### LAW-GRD-005 (HARD) — No "Just Make It Work"

Temporary hacks, placeholders, or "we'll fix it later" logic are forbidden unless:
- Explicitly labeled
- Scoped
- Tracked
- Scheduled for removal

**Enforcement:** Technical debt registry, GC agent sweeps

---

### LAW-GRD-006 (HARD) — Harness First, Not Prompt First

Prompts are secondary. Harness is primary.

Every agent must operate within:
- Structural invariants
- Role permissions
- Attached contracts
- Observability requirements
- Review pipeline
- Entropy control rules

**Enforcement:** Harness validation gates, CI checks

---

### LAW-GRD-007 (HARD) — No Commented-Out Code

Commented-out code is forbidden in production branches and merge-ready PRs.

**Forbidden:**
- Commenting out failing logic instead of fixing it
- Leaving dead blocks "for later"
- Shipping "optional" paths as comments

**Allowed only if ALL are true:**
1. It is inside an explicitly-scoped experiment sandbox path (defined in boundaries policy)
2. It has a sunset date
3. It is tracked in tech-debt registry
4. It is excluded from production build targets

**Enforcement:** Linter rule rejects commented-out code patterns + CI gate blocks merge

---

### LAW-GRD-008 (HARD) — Production-Grade Requirement

All code produced by humans or agents must be production-grade by default.

**Minimum bar:**
- Correctness-oriented (not "demo works")
- Error handling + typed boundaries
- Deterministic behavior where required
- Observability hooks (logs/metrics/traces as applicable)
- Tests proportional to risk tier

**Explicitly forbidden:**
- "Simple implementation" when requirements imply robustness
- "TODO: implement later" in core paths
- "Stubbed" behavior that changes semantics

**Enforcement:** Risk-tier policy + quality gates + reviewer agent blocks

---

### LAW-GRD-009 (HARD) — No Placeholders in Merge-Ready Work

Placeholder code is forbidden in any branch intended for merge.

**Placeholder includes:**
- Fake returns / hardcoded constants that stand in for real logic
- Empty method bodies
- "Temporary" bypass conditions
- UI placeholders that misrepresent state

**Exception path (only):**
- Must be labeled `PLACEHOLDER_APPROVED` with:
  - WIH reference
  - Removal plan
  - Deadline
  - Acceptance-test expectation that explicitly tolerates it

**Enforcement:** Placeholder scanner + WIH cross-check + CI blocks

---

### LAW-GRD-010 (HARD) — No Silent Degradation

If a robust solution is required, you may not degrade to a weaker implementation without declaring it as a design decision.

**Required artifact:** ADR or Delta explaining:
- Why robust path is deferred
- What risks are accepted
- What triggers remediation

**Enforcement:** Reviewer agent checks for "degradation without ADR"

---

## PART II: PROJECT ORGANIZATION

### LAW-ORG-001 (HARD) — PRD-First Development

Every meaningful unit of work must begin with a spec or PRD.

Code without a governing spec is invalid.

**Required Spec References:**
- `/SYSTEM_LAW.md` (Source of Truth)
- `/spec/Baseline.md` or `/spec/Deltas/*`
- Relevant contracts from `/spec/Contracts/*`
- Acceptance tests from `/spec/AcceptanceTests.md`

**Enforcement:** WIH header validation, CI gates

---

### LAW-ORG-002 (HARD) — Command-ify Everything

All work must be reducible to explicit commands:
- Inputs
- Outputs
- Side effects

If it cannot be commanded, it is not ready to be executed.

**Enforcement:** Tool registry schemas, contract validation

---

### LAW-ORG-003 (HARD) — Context Reset Discipline

Context must be:
- Discoverable
- Reloadable
- Reconstructible

No work may rely on implicit conversational memory.

**Enforcement:** Context pack generation, session isolation

---

### LAW-ORG-004 (SOFT) — Modular Rules Architecture

Rules, constraints, and logic should be:
- Modular
- Composable
- Independently testable

**Enforcement:** Linting, structural tests

---

### LAW-ORG-005 (SOFT) — System Evolution Mindset

Failures are inputs to system evolution, not exceptions.

Fixes must become:
- Rules
- Tests
- Specs

Not tribal knowledge.

**Enforcement:** Garbage collection agents, drift detection

---

### LAW-ORG-006 (HARD) — Living Files Doctrine

A **Living File** is a versioned artifact that:
1. Is referenced by agents during execution
2. Is validated mechanically (CI, lint, contract test, or policy gate)
3. Influences behavior or decision-making
4. Is subject to drift detection
5. Can trigger automated remediation

**Categories of Living Files:**

| Category | Purpose | Examples |
|----------|---------|----------|
| **Intent Files** | Define what should exist | `/spec/baseline/*`, `/spec/deltas/*` |
| **Constraint Files** | Define invariants | `/agent/policy.md`, `/ARCHITECTURE.md` |
| **Quality Ledger** | Measure coherence | `/quality/domain-grades.md`, `/quality/entropy-score.md` |
| **Runtime Legibility** | Expose system behavior | `/runtime/observability/*`, `/runtime/traces/*` |
| **Generated Files** | Machine-produced artifacts | `/docs/generated/*`, `/evidence/*` |

**Enforcement Rule:** No file may exist without a declared validation surface.

**Enforcement:** Doc-gardener agents, CI validation, drift detection

---

### LAW-ORG-007 (HARD) — Explicit Invariant Registry

There must exist a canonical, machine-readable invariant registry.

**Required Contents:**
- Explicit invariant files (`/spec/invariants/*.yaml`)
- Invariant versioning (semantic versioned)
- Invariant coverage mapping (which code/tests validate each invariant)
- Invariant violation history

**Invariant Structure:**
```yaml
invariant_id: INV-001
name: "No cross-boundary imports"
type: "structural"
validation: "boundary_lint.rs"
severity: "error"
coverage:
  - "harness/boundary_lint.rs"
  - "ci/scripts/allternit-validate-boundaries"
```

**Enforcement:** Invariant validator, CI gates, coverage reports

---

### LAW-ORG-008 (HARD) — Knowledge Retention & Expiry Law

Not all knowledge becomes permanent.

**Retention Classes:**

| Class | Retention | Examples |
|-------|-----------|----------|
| **Permanent** | Indefinite | SYSTEM_LAW.md, SOT.md, Contracts |
| **Long-term** | 12 months | Architecture decisions, major deltas |
| **Medium-term** | 90 days | Session summaries, run evidence |
| **Short-term** | 7 days | Debug logs, temporary artifacts |
| **Ephemeral** | 24 hours | Cache, working state |

**Enforcement:** GC agents enforce expiry, archival policy

---

### LAW-ORG-009 (HARD) — Contract Versioning & Deprecation Law

All contracts must follow versioning and deprecation lifecycle.

**Versioning Rules:**
- Semantic versioning (MAJOR.MINOR.PATCH)
- Breaking changes require MAJOR version increment
- Deprecated contracts must have 30-day sunset period
- Migration path required for breaking changes

**Deprecation Lifecycle:**
```
Active → Deprecated (30 days) → Removed
```

**Enforcement:** Contract validator, migration tests, deprecation warnings

---

## PART III: AGENTIC FRAMEWORK

### LAW-META-001 (HARD) — Baseline + Deltas Model

There must exist:
- A Baseline (canonical truth)
- Deltas (explicit changes)

No mutation of the baseline without a delta.

**Baseline Documents:**
- `/SYSTEM_LAW.md`
- `/spec/Baseline.md`
- `/spec/Contracts/*`

**Delta Documents:**
- `/spec/Deltas/*` (append-only)

**Enforcement:** Delta validation, spec reference checks

---

### LAW-META-002 (HARD) — Single Source of Truth

Every system must declare exactly one SOT.

Duplicated truth is a defect.

**Current SOT:** `/SYSTEM_LAW.md`

**Enforcement:** Cross-reference validation, contradiction detection

---

### LAW-META-003 (HARD) — Role-Bound Agents

Agents operate in explicit roles.

No agent may:
- Self-assign roles
- Cross roles silently

**Canonical Roles:**

| Role | Permissions | Restrictions |
|------|-------------|--------------|
| **Architect** | Edit `/spec/*` only | Cannot modify code |
| **Implementer** | Modify code within scope_paths | Cannot modify spec |
| **Tester** | Write tests only | Cannot write features |
| **Reviewer** | Comment only | Cannot modify code |
| **Security** | Gate destructive tools | Cannot write features |

**Enforcement:** Role isolation in harness, tool allowlists

---

### LAW-META-004 (HARD) — Deterministic Loop

All agent workflows must follow a visible loop:

```
Research → Context → Plan → Act → Report
```

Skipping steps requires justification.

**Enforcement:** State machine transitions, WIH lifecycle

---

### LAW-META-005 (HARD) — Meta-Learning Is Structural

Learning may:
- Produce new specs
- Update rules
- Add tests

Learning may not silently alter runtime behavior.

**Enforcement:** Delta documentation, ADR requirements

---

### LAW-META-006 (HARD) — A2A Deterministic Review Protocol

All code changes must pass through deterministic agent-to-agent review:

**Review State Machine:**
```
TASK_CREATED →
IMPLEMENTATION_RUNNING →
SELF_REVIEW →
STRUCTURAL_VALIDATION →
TEST_EXECUTION →
SECURITY_SCAN →
POLICY_EVALUATION →
MERGE_READY →
MERGED
```

**Required Review Roles:**
1. Implementer Agent
2. Self-Reviewer Agent
3. Structural Reviewer Agent
4. Tester Agent
5. Security Reviewer Agent
6. Policy Gate Agent
7. Garbage Collector Agent (background)

**Human Required Only If:**
- Spec conflict
- Architectural violation requiring re-design
- Risk tier exceeds threshold
- Ethical/legal ambiguity

**Enforcement:** Review protocol state machine, CI gates

---

### LAW-META-007 (HARD) — WIH Mandatory for All Work

Every unit of work must have a WIH header before execution begins.

**No WIH = no run.**

Applies to:
- Code changes
- Docs changes
- Refactors
- Tooling
- Generated artifacts

**WIH must include:**
- Role
- scope_paths
- contracts/spec refs
- risk_tier
- acceptance refs
- evidence expectations

**Enforcement:** Preflight gate rejects tasks without valid WIH

---

### LAW-META-008 (HARD) — Rails-Orchestrated Execution Only

All execution must run through Agent Rails orchestration.

**Forbidden:**
- Ad-hoc tool execution outside Rails
- Model "direct action" without IO gate
- Bypassing lifecycle states

**Required:** Task lifecycle state machine + receipts + hashes

**Enforcement:** Tool gateway only accepts Rails-issued signed intents

---

## PART IV: ONTOLOGY

### LAW-ONT-001 (HARD) — Canonical Entity Definitions

| Entity | Definition | Authority | Restrictions |
|--------|------------|-----------|--------------|
| **IO** | Execution Authority | ONLY component permitted to cause side effects | Must record every action in journal |
| **Kernel** | Deterministic Logic Core | Pure decision logic only | Must NOT perform IO, execute tools, write files |
| **Models** | Probabilistic Proposers | Produce proposals, never execute | Must NOT execute side effects directly |
| **Shell** | Presentation Surface | Renders IO state, collects input | Must NOT be source of truth |
| **Gizzi** | Persona / Presence | User-facing identity | Must NOT have execution power |

**Enforcement:** Ontology validation, import restrictions

---

### LAW-ONT-002 (HARD) — Authority Law

Only IO can execute side effects.

No Shell, no Model, no Kernel bypass. Every effect flows through IO.

**Enforcement:** Tool gateway, policy engine

---

### LAW-ONT-003 (HARD) — Determinism Law

Kernel must remain deterministic and replayable.

Given the same inputs, Kernel produces the same outputs. Always.

**Enforcement:** Determinism tests, replay validation

---

### LAW-ONT-004 (HARD) — Proposal Law

Models only propose; IO decides and executes.

**Enforcement:** Model output validation, IO gate checks

---

### LAW-ONT-005 (HARD) — Truth Law

IO journal + persisted state are the source of truth.

Not the UI. Not the model's memory. Not cached state.

**Enforcement:** Journal validation, state persistence checks

---

### LAW-ONT-006 (HARD) — Surface Law

Shell is a renderer; it may be replaced without affecting IO state.

**Enforcement:** State isolation, renderer contracts

---

### LAW-ONT-007 (HARD) — Persona Law

Gizzi is presence; never a privileged executor.

**Enforcement:** Permission checks, role isolation

---

### LAW-ONT-008 (HARD) — IO Idempotency & Replay Law

All IO operations must be:
- Idempotent (same input → same output, regardless of execution count)
- Replayable (given journal + inputs, reproduce exact outputs)
- Correlation-ID tracked (every operation has unique, traceable ID)

**Idempotency Requirements:**
- Idempotency key required for all state-changing operations
- Duplicate detection within 24-hour window
- Exactly-once semantics for tool execution

**Replay Guarantees:**
- Journal must contain sufficient information to reproduce execution
- Deterministic time binding (logical timestamps, not wall-clock)
- Seed binding for all probabilistic operations

**Enforcement:** IO gateway validation, replay tests, correlation tracking

---

### LAW-ONT-009 (HARD) — Canonical State Transition Law

IO state transitions must follow explicit, enumerated state machine.

**Required State Fields:**
- Current state (enumerated)
- Allowed transitions (explicit list)
- Transition guards (preconditions)
- Transition effects (postconditions)

**State Machine Requirements:**
- No implicit transitions
- No undocumented state mutations
- All transitions logged in journal

**Enforcement:** State machine validator, transition logging

---

### LAW-ONT-010 (HARD) — Deterministic Randomness Binding

All stochastic operations must be bound to deterministic seeds.

**Requirements:**
- Seed derived from correlation ID (deterministic)
- Randomness isolated in dedicated module
- Seed logged in receipts for replay
- No unseeded random calls in execution path

**Enforcement:** Randomness isolation tests, seed validation

---

### LAW-ENT-001 (HARD) — IO Service Definition

The IO Service is the concrete implementation of the IO entity.

**Service Details:**
| Attribute | Value |
|-----------|-------|
| **Name** | `allternit-io-service` |
| **Location** | `services/io-service/` |
| **Port** | 3510 |
| **Bind** | 127.0.0.1 (internal only) |
| **Binary** | `allternit-io-service` |
| **Implements** | LAW-ONT-002, LAW-ONT-003, LAW-ONT-008 |

**Responsibilities:**
- Tool execution (local, HTTP, MCP, SDK, subprocess)
- IO capture and logging
- Policy enforcement BEFORE execution
- Resource isolation and limits
- Execution telemetry and audit trails
- Retry and backoff mechanisms
- Idempotency support

**Constitutional Boundary:**
```
┌─────────────────┐     ┌─────────────────┐
│  Kernel Service │────►│   IO Service    │
│  (pure logic)   │     │  (side effects) │
│  Port: 3004     │     │  Port: 3510     │
└─────────────────┘     └─────────────────┘
```

**Enforcement:** Service startup validation, import restrictions, CI gates

---

### LAW-ENT-002 (HARD) — Kernel Service Definition

The Kernel Service is the concrete implementation of the Kernel entity.

**Service Details:**
| Attribute | Value |
|-----------|-------|
| **Name** | `kernel-service` |
| **Location** | `services/orchestration/kernel-service/` |
| **Port** | 3004 |
| **Bind** | 127.0.0.1 (internal only) |
| **Binary** | `kernel` |
| **Implements** | LAW-ONT-003 (Determinism) |

**Responsibilities:**
- Deterministic decision logic
- Session management
- Intent routing
- State transitions (pure, no side effects)
- Tool Gateway calls IO Service (HTTP) - does NOT execute tools directly

**Ontology Compliance Note:**
The Kernel Service MUST NOT import or use ToolGateway directly. All tool execution MUST flow through IO Service via HTTP.

**Enforcement:** Import validation, CI gates, ontology compliance tests

---

## PART V: FAILURE & OPERATIONS

### LAW-AUT-001 (HARD) — No-Stop Execution Rule

If a DAG has READY work and budget/policy allows, the runner must pickup and execute the next WIH.

**Prohibited:**
- "Waiting for user" unless a gate explicitly requires it
- Idling while READY nodes exist
- Terminating loop without explicit policy violation

**Required:**
- Deterministic READY ordering (priority, then nodeId lexical)
- Continuous execution while budget allows
- Auto-renewal of leases during long-running sessions

**Enforcement:** Ralph Loop Compliance Gate, CI validation

---

### LAW-AUT-002 (HARD) — Deterministic Rehydration Rule

Every WIH execution must begin from a sealed ContextPack.

**ContextPack Must Include:**
- Tier-0 LAW (SYSTEM_LAW.md)
- SOT.md
- Architecture.md
- Relevant Contracts from `/spec/Contracts/`
- Relevant Deltas from `/spec/Deltas/`
- The WIH itself (wih_id, scope, role, acceptance refs)

**ContextPack Seal Must Include:**
- pack_id (deterministic hash)
- inputs_manifest (list of all inputs with hashes)
- method_version (ContextPack builder version)
- created_at (ISO-8601)

**Enforcement:** ContextPack validator, receipt validation

---

### LAW-AUT-003 (HARD) — Lease Continuity Rule

Long-running sessions must auto-renew leases before expiry.

**Requirements:**
- Renew at T-60 seconds before expiry (or policy-defined threshold)
- Background renewer must run continuously during execution
- Hard fail to "paused" state if renew denied (do not continue without lease)
- Emit lease renewal receipts for audit trail

**Enforcement:** Lease manager, receipt validation

---

### LAW-AUT-004 (HARD) — Evidence/Receipts Queryability Rule

The system must support querying receipts to decide next actions deterministically.

**Required Queries:**
- `GET /receipts/query?run_id=&wih_id=&type=` (paged)
- Query by receipt kind (injection_marker, context_pack_seal, tool_call_pre, tool_call_post, etc.)
- Query by correlation_id (trace across events)

**Ralph Loop Must:**
- Query receipts before retrying a WIH (avoid duplication)
- Query receipts to determine if node is complete
- Use receipts as canonical truth (not local state)

**Enforcement:** Receipt API, CI validation

---

### LAW-AUT-005 (HARD) — Prompt Delta Escape Hatch Rule

If progress is blocked by missing context, the runner must emit PromptDeltaNeeded as a structured request.

**Required Fields:**
- dag_id, node_id, wih_id
- reason_code: MISSING_INPUT | AMBIGUOUS_REQUIREMENT | PERMISSION_APPROVAL_REQUIRED | OTHER
- requested_fields: list of field names needed
- correlation_id

**Ralph Loop Must:**
- Emit PromptDeltaNeeded and continue with other READY nodes
- Never idle on missing context
- Resume blocked WIH when delta is provided

**Enforcement:** PromptDeltaNeeded schema validation, loop compliance gate

---

### LAW-OPS-001 (HARD) — Failure Classification Law

All failures must be classified into canonical categories.

**Failure Classes:**

| Class | Definition | Retriable | Escalates | Invalidates Evidence |
|-------|------------|-----------|-----------|---------------------|
| **BOOT_FAIL** | Worker failed to start | Yes (3x) | After 3 retries | No |
| **SETUP_FAIL** | Environment setup failed | Yes (2x) | After 2 retries | No |
| **SERVICE_FAIL** | External service unavailable | Yes (with backoff) | On persistent failure | No |
| **CHECK_FAIL** | Validation/acceptance failed | No | On risk tier ≥3 | No |
| **TEST_FAIL** | Tests failed | No | On risk tier ≥3 | No |
| **POLICY_VIOLATION** | Policy gate rejected | No | Always | Yes |
| **TIMEOUT** | Operation exceeded time limit | Yes (1x) | On persistent timeout | No |
| **SUSPECTED_COMPROMISE** | Security anomaly detected | No | Always | Yes |

**Enforcement:** Failure classifier, escalation protocol, quarantine on compromise

---

### LAW-OPS-002 (HARD) — Rollback & Reconciliation Law

All state-changing operations must have rollback semantics.

**Rollback Requirements:**
- Rollback plan declared in WIH for risk tier ≥2
- Checkpoint before state mutation
- Rollback tested for critical paths

**Reconciliation Protocol:**
- Divergence detection (expected vs actual state)
- Reconciliation strategy (automatic vs manual)
- Reconciliation receipt emitted

**Enforcement:** Rollback validator, checkpoint system, reconciliation tests

---

### LAW-OPS-003 (HARD) — Retry Semantics Law

Retry behavior must be explicit and bounded.

**Retry Rules:**
- Max retries per operation type (see LAW-OPS-001)
- Exponential backoff with jitter
- Retry budget per session (max 10 retries)
- Circuit breaker after 5 consecutive failures

**Retry Transparency:**
- Retry count logged in receipts
- Backoff duration visible in observability
- Retry cause classified (transient vs permanent)

**Enforcement:** Retry limiter, circuit breaker, backoff enforcement

---

## PART VI: ENFORCEMENT & AUTOMATION

### LAW-ENF-001 (HARD) — Mandatory Load Order

Agents and tools must load, in order:
1. This document (SYSTEM_LAW.md)
2. `/SOT.md`
3. Relevant specs

No execution before load.

**Enforcement:** Context pack validation, WIH header checks

---

### LAW-ENF-002 (HARD) — Auditability

All actions must be:
- Attributable
- Reproducible
- Explainable

If it cannot be audited, it cannot run.

**Enforcement:** Receipt emission, evidence artifacts

---

### LAW-ENF-003 (SOFT) — CI & Gatekeeping

Where possible, enforcement should be automated via:
- Linting
- Spec checks
- Acceptance tests

**Enforcement:** CI pipeline, harness gates

---

### LAW-ENF-004 (HARD) — Harness Engineering Requirements

The harness must include:

**1. Context Engineering:**
- Continuously evolving structured knowledge
- Knowledge base integrated into codebase
- External context (observability, browser navigation)

**2. Architectural Constraints:**
- Custom linters
- Structural tests
- Explicit architectural boundaries

**3. Garbage Collection Agents:**
- Detect documentation drift
- Find architectural violations
- Maintain internal consistency

**Enforcement:** Harness validation, CI gates

---

### LAW-ENF-005 (HARD) — Entropy Compression Engine

Entropy must be continuously compressed.

**Golden Principles:**
- No unvalidated external data
- Boundary parsing required
- Shared utilities over duplication
- Structured logging mandatory
- No silent catch
- Max file size threshold
- Strict dependency direction

**Garbage Collection Agents Run Daily:**
1. Detect duplicate utilities
2. Detect untyped boundary usage
3. Detect dependency violations
4. Detect missing observability
5. Detect stale documentation
6. Improve test coverage gaps

**Enforcement:** GC agent automation, entropy score tracking

---

### LAW-ENF-006 (HARD) — Observability Legibility Contract

Agents must be able to inspect runtime state deterministically.

If behavior cannot be queried, it cannot be corrected.

**Required Surfaces:**
1. Structured logs (queryable via LogQL-like interface)
2. Metrics (queryable via PromQL-like interface)
3. Traces (span per major action)
4. UI state (DOM snapshot, screenshot capability)
5. Performance stats (response time, error rate)

**Enforcement:** Observability contract validation, CI checks

---

### LAW-ENF-007 (HARD) — Canonical Event Schema Law

All events must follow canonical schema.

**Required Event Fields:**
```yaml
event_id: "evt_<uuid>"
timestamp: "<ISO-8601>"
correlation_id: "<corr_uuid>"
session_id: "<session_uuid>"
event_type: "<namespace.event_name>"
severity: "info|warn|error|critical"
source: "<component_id>"
payload: "<structured_data>"
context:
  prefix_hash: "<hash>"
  toolset_hash: "<hash>"
  workspace_hash: "<hash>"
```

**Enforcement:** Event schema validator, CI rejection of non-conforming events

---

### LAW-ENF-008 (HARD) — Lazy-Pattern Rejection Gates

The harness must block merges when any of these patterns are detected without approved exception metadata:

**Forbidden Patterns:**
- Commented-out code
- Placeholder/stub logic
- TODO/FIXME in production paths
- "Simple implementation" markers (policy-defined heuristics)
- Missing error handling in boundary functions
- Missing observability where required by risk tier

**Enforcement:** CI gate + policy agent + structural lints

---

## PART VII: SECURITY

### LAW-SEC-001 (HARD) — Mandatory Threat Model

Every system component must have a threat model.

**Required Contents:**
- Attack surface mapping
- Trust boundaries
- Data classification tiers
- Threat scenarios (STRIDE or equivalent)
- Mitigation strategies

**Location:** `/spec/threat-models/*.md`

**Enforcement:** Threat model review in CI, security agent validation

---

### LAW-SEC-002 (HARD) — Data Classification & Handling Law

All data must be classified and handled according to sensitivity.

**Classification Tiers:**

| Tier | Examples | Handling Requirements |
|------|----------|----------------------|
| **Public** | Documentation, public APIs | No special handling |
| **Internal** | Code, configs | Access control, encryption at rest |
| **Confidential** | API keys, user data | Encryption in transit + rest, audit trail |
| **Secret** | Private keys, credentials | HSM/vault storage, never logged, rotation |

**Enforcement:** Data classification validator, secrets scanner, vault integration

---

### LAW-SEC-003 (HARD) — External Tool Boundary Law

All external tool calls must pass through security boundary.

**Requirements:**
- Allowlist of permitted external calls
- Input sanitization before external call
- Output validation after external call
- Rate limiting per external service
- Circuit breaker on external service failure

**Enforcement:** External tool gateway, input/output validators, rate limiter

---

## PART VIII: TOOL GOVERNANCE

### LAW-TOOL-001 (HARD) — Tool Capability Classification

All tools must be classified by capability and risk tier.

**Capability Classes:**

| Class | Examples | Default Risk Tier |
|-------|----------|-------------------|
| **Read** | File read, API GET | Low |
| **Write** | File write, DB update | Medium |
| **Execute** | Shell, code execution | High |
| **Destructive** | rm, drop table, prod deploy | Critical |
| **External** | Network calls, webhooks | Variable |

**Enforcement:** Tool registry classification, capability-based policy binding

---

### LAW-TOOL-002 (HARD) — Capability-Based Policy Binding

Policy enforcement must be bound to tool capability class.

**Policy Binding Rules:**

| Capability | PreToolUse Gate | Approval Required | Receipt Required |
|------------|-----------------|-------------------|------------------|
| Read | Schema validation | No | Yes |
| Write | Schema + path validation | Risk tier ≥3 | Yes |
| Execute | Full policy check | Risk tier ≥2 | Yes |
| Destructive | Security review | Always (human for tier 4) | Yes |
| External | Allowlist check | Risk tier ≥2 | Yes |

**Enforcement:** Policy engine, capability-aware gate checks

---

## PART IX: SWARM ORCHESTRATION

### LAW-SWM-001 (HARD) — Deterministic DAG Execution

All swarm execution must follow deterministic DAG semantics:

- Graph must be acyclic
- Scheduler executes in topological order
- Node becomes READY when all dependencies are DONE
- Execution order is deterministic given fixed inputs + policy

**Enforcement:** DAG validation, scheduler tests

---

### LAW-SWM-002 (HARD) — Parallelism Without Shared Mutable State

Parallel agents may not share mutable state.

**Communication Channels:**
- Message bus (control plane mediated)
- Shared read-only context packs
- Shared artifact store (append-only manifests)

**Enforcement:** Isolation tests, state mutation detection

---

### LAW-SWM-003 (HARD) — Conflict Arbitration

If multiple agents produce overlapping diffs:

1. Prefer higher-priority node
2. If equal priority: prefer node with stronger evidence (tests passed + narrower diff)
3. Otherwise: split into separate PRs

**Enforcement:** Diff overlap detector, arbitration engine

---

### LAW-SWM-004 (HARD) — Budget-Aware Scheduling

All swarms must declare and enforce budgets:

- Max wall clock time
- Max CPU-seconds
- Max memory-seconds
- Max egress
- Max spawned EIs
- Max retries

**Enforcement:** Budget metering, admission control

---

### LAW-SWM-005 (HARD) — Evidence-First Outputs

All swarm outputs must include:

- Receipts (tool calls, commands, stdout/stderr)
- Hashes: envHash, policyHash, inputsHash, codeHash
- Artifact manifests with integrity hashes

**Enforcement:** Receipt validation, evidence schema checks

---

### LAW-SWM-006 (HARD) — Logical Time & Deterministic Scheduling Law

All time-dependent operations must use logical time, not wall-clock.

**Logical Time Requirements:**
- Lamport timestamps or vector clocks for event ordering
- Logical timeouts (based on event count, not wall-clock)
- Time synchronization protocol for distributed nodes
- Deterministic scheduling (same inputs → same schedule)

**Wall-Clock Prohibitions:**
- No wall-clock timestamps in L0-L2 prompt layers
- No wall-clock dependencies in deterministic paths
- No timezone-dependent logic in core execution

**Enforcement:** Time validator, logical clock tests, determinism verification

---

### LAW-SWM-007 (HARD) — Admission Control & Fairness Law

Swarm admission must be controlled to prevent resource starvation.

**Admission Control Requirements:**
- Maximum concurrent swarm count per tenant
- Resource contention arbitration (priority-based)
- Starvation prevention (minimum resource allocation)
- Queue management with fair scheduling

**Fairness Rules:**
- No single tenant can monopolize resources
- High-priority work can preempt low-priority (with checkpoint)
- Resource quotas enforced per tenant

**Enforcement:** Admission controller, quota enforcement, fair scheduler

---

### LAW-SWM-008 (HARD) — DAG-Only Execution

All multi-step work is represented as a DAG.

**Forbidden:**
- Implicit sequencing inside "one big agent run"
- Hidden sub-steps without nodes
- Untracked side quests

**Required:**
- Node IDs
- Dependencies
- Deterministic topo ordering
- Per-node evidence output

**Enforcement:** Scheduler rejects non-DAG execution plans

---

### LAW-SWM-009 (HARD) — DAG + WIH Coupling

Every DAG node must map to exactly one WIH (or one WIH section) and vice versa.

**Rules:**
- Node → WIH reference required
- Node outputs must satisfy WIH acceptance/evidence requirements
- Cross-node mutation forbidden unless declared as dependency artifacts

**Enforcement:** DAG validator cross-checks WIH graph references

---

## PART X: TIME & PERFORMANCE

### LAW-TIME-001 (HARD) — Clock Authority Law

There must be exactly one clock authority for the system.

**Requirements:**
- Designated clock service (NTP-synced for wall-clock, logical for execution)
- All timestamps traceable to clock authority
- Clock skew detection and compensation
- Timezone normalization (UTC for all internal operations)

**Enforcement:** Clock service, skew detection, timestamp validation

---

### LAW-TIME-002 (HARD) — Performance Budget Law

All components must declare and enforce performance budgets.

**Required Budgets:**
- Latency budget (p50, p95, p99)
- Throughput budget (ops/sec)
- Resource budget (CPU, memory, I/O)
- Cache budget (hit rate targets)

**Enforcement:** Performance monitoring, budget violation alerts, circuit breakers

---

### LAW-TIME-003 (HARD) — Circuit Breaker Law

All external calls and critical paths must have circuit breaker protection.

**Circuit Breaker States:**
- CLOSED (normal operation)
- OPEN (failing, reject immediately)
- HALF-OPEN (testing recovery)

**Trip Conditions:**
- 5 consecutive failures → OPEN
- 30-second cooldown → HALF-OPEN
- Success in HALF-OPEN → CLOSED
- Failure in HALF-OPEN → OPEN (2x cooldown)

**Enforcement:** Circuit breaker library, failure tracking, state visibility

---

## PART XI: QUALITY LEDGER

### LAW-QLT-001 (HARD) — Domain Grades

Each domain must be graded on:
- Architecture adherence
- Test coverage
- Observability completeness
- Boundary enforcement
- Drift frequency

**Location:** `/quality/domain-grades.md`

**Enforcement:** Grade calculation, visibility to agents

---

### LAW-QLT-002 (HARD) — Entropy Score

Entropy is calculated from:
- Rule violations
- Drift rate
- Test coverage delta
- Documentation mismatch

**Location:** `/quality/entropy-score.md`

**Enforcement:** Daily calculation, GC agent triggers

---

### LAW-QLT-003 (SOFT) — Quality Optimization

Agents optimize for grade improvement.

**Enforcement:** Grade visibility, GC agent priorities

---

## PART XII: CHANGE CONTROL

### LAW-CHG-001 (HARD) — Modifying System Law

Changes to this document require:
- An ADR (Architecture Decision Record)
- Explicit rationale
- Version increment

**Enforcement:** ADR validation, version checks

---

### LAW-CHG-002 (HARD) — Append-Only Mentality

Rewrites must preserve:
- History
- Intent
- Traceability

**Enforcement:** Delta documentation, git history validation

---

### LAW-CHG-003 (HARD) — Drift Protocol

Drift is defined as: Difference between encoded intent and observable behavior.

**Detection Mechanisms:**
- Doc-gardener agent
- Structural lint
- Contract test
- Runtime invariant violation
- Entropy score regression

**Resolution:** Drift is corrected by agent PR within 24 hours.

**Enforcement:** Drift detection agents, automated remediation

---

## PART XIII: OPERATIONAL CHEAT SHEET

### If you are...

| Role | Read These Sections |
|------|---------------------|
| **Writing code** | LAW-ORG-001 to LAW-ORG-003, LAW-ENF-004, LAW-GRD-007 to LAW-GRD-010 |
| **Building agents** | LAW-META-001 to LAW-META-008, LAW-ONT-001 to LAW-ONT-010 |
| **Designing workflows** | LAW-GRD-004, LAW-META-004, LAW-SWM-001 to LAW-SWM-009 |
| **Refactoring** | LAW-GRD-003, LAW-CHG-002, LAW-ORG-009 |
| **Automating decisions** | LAW-ENF-001 to LAW-ENF-008 |
| **Running swarms** | LAW-SWM-001 to LAW-SWM-009, LAW-TIME-001 to LAW-TIME-003 |
| **Maintaining quality** | LAW-ENF-005, LAW-QLT-001 to LAW-QLT-003 |
| **Security review** | LAW-SEC-001 to LAW-SEC-003, LAW-TOOL-001 to LAW-TOOL-002 |
| **Handling failures** | LAW-OPS-001 to LAW-OPS-003 |

---

## PART XIV: FINAL CLAUSE

This document exists to protect clarity, enable speed, and prevent entropy.

If something feels cumbersome:
- Simplify the system
- Not the law

**Authority:** This document is Tier-0. All other documents derive authority from it.

**Location:** `/SYSTEM_LAW.md` (repo root)

**Index:** `/docs/LAW_INDEX.md` (cross-references to domain-specific applications)

**Name Change Notice:** This document was previously named `PROJECT_LAW.md`. Renamed to `SYSTEM_LAW.md` on 2026-02-20 to reflect system-wide constitutional authority.

---

## APPENDIX A: DOMAIN-SPECIFIC APPLICATIONS

### A.1 DAK Runner Law (`/5-agents/AGENTS.md`)

**Scope:** All agents running under the Deterministic Agent Kernel (DAK)

**Relationship to SYSTEM_LAW.md:** This is the DAK-specific application of SYSTEM_LAW.md principles.

**Key Additions:**
- Authority separation (Rails vs DAK Runner)
- Tool execution rule (PreToolUse gate, receipts)
- Write discipline (`.allternit/runner/` boundaries)
- Mutual blocking (Builder ≠ Validator)
- Ralph loop rules (bounded fix cycles)

**Conflicts:** None. AGENTS.md operationalizes SYSTEM_LAW.md for DAK context.

---

### A.2 Harness Engineering Spec (`/spec/HarnessEngineering.md`)

**Scope:** Harness implementation requirements

**Relationship to SYSTEM_LAW.md:** This implements LAW-ENF-004 (Harness Engineering Requirements).

**Key Additions:**
- Context pack generator
- Structural linters
- Risk tier enforcement
- Tool wrapper system
- Evidence-based merge

**Conflicts:** None. This is the implementation spec for LAW-ENF-004.

---

### A.3 Living Files Doctrine (`/docs/governance/LIVING_FILES_DOCTRINE.md`)

**Scope:** Living Files definition and enforcement

**Relationship to SYSTEM_LAW.md:** This expands LAW-ORG-006 (Living Files Doctrine).

**Key Additions:**
- Five categories of Living Files
- Drift protocol
- Validation surface requirements

**Conflicts:** None. This is the doctrinal expansion of LAW-ORG-006.

---

### A.4 A2A Review Protocol (`/agent/review-protocol.md`)

**Scope:** Agent-to-Agent review state machine

**Relationship to SYSTEM_LAW.md:** This implements LAW-META-006 (A2A Deterministic Review Protocol).

**Key Additions:**
- State machine definition
- Role definitions
- Escalation rules
- Merge philosophy

**Conflicts:** None. This is the implementation of LAW-META-006.

---

### A.5 Garbage Collection Engine (`/agent/garbage-collection.md`)

**Scope:** Entropy compression automation

**Relationship to SYSTEM_LAW.md:** This implements LAW-ENF-005 (Entropy Compression Engine).

**Key Additions:**
- Golden principles
- GC agent specifications
- Entropy score calculation

**Conflicts:** None. This is the implementation of LAW-ENF-005.

---

### A.6 Prompt Caching Doctrine (`/spec/ADRs/ADR-CACHE-001.md`)

**Scope:** Prompt prefix stability and cache optimization

**Relationship to SYSTEM_LAW.md:** This implements LAW-GRD-005 (No "Just Make It Work") and LAW-ENF-006 (Observability).

**Key Additions:**
- L0-L3 prompt layering
- Tool stubs + defer-loading
- Cache health metrics
- Prefix drift detection

**Conflicts:** None. This is the implementation of cache-aware execution.

---

## APPENDIX B: VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-20 | Initial consolidation of PROJECT_LAW.md, AGENTS.md, ONTOLOGY_LAW.md, Guardrails.md, Living Files Theory, Harness Engineering, A2A Review Protocol, Garbage Collection Engine |
| 2.0.0 | 2026-02-20 | Renamed to SYSTEM_LAW.md; Added LAW-GRD-007 to LAW-GRD-010 (anti-laziness), LAW-META-007 to LAW-META-008 (WIH + Rails), LAW-OPS-001 to LAW-OPS-003 (failure semantics), LAW-ONT-008 to LAW-ONT-010 (IO replay + randomness), LAW-SEC-001 to LAW-SEC-003 (security), LAW-TOOL-001 to LAW-TOOL-002 (tool taxonomy), LAW-SWM-006 to LAW-SWM-009 (time + DAG), LAW-TIME-001 to LAW-TIME-003 (clock + performance), LAW-ENF-007 to LAW-ENF-008 (event schema + lazy patterns), LAW-ORG-007 to LAW-ORG-009 (invariants + retention + versioning) |

---

**End of Allternit SYSTEM LAW**
