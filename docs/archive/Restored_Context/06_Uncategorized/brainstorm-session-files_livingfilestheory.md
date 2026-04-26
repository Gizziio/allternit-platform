Joe — we’re going to formalize this properly.

Not vibes.
Not tweets.
A doctrine.

What you’re describing is not “better documentation.”

It’s a repository-native cognition architecture.

Below is the expanded Living Files Theory + the structural blueprint for Allternit incorporating:
	•	A2A review loop
	•	UI + observability legibility
	•	Garbage collection engine
	•	Progressive knowledge structure
	•	Harness-first philosophy

This is written as internal doctrine.

⸻

THE LIVING FILES THEORY

(Allternit Canonical Formulation v1)

⸻

I. The Core Problem

Most software repositories contain:
	•	Code
	•	Tests
	•	Docs
	•	Plans
	•	Notes
	•	Slack decisions
	•	Tribal knowledge

But only code executes.

Everything else is passive.

Passive artifacts create entropy because:
	•	They are not validated.
	•	They are not enforced.
	•	They are not updated automatically.
	•	They are not referenced mechanically.
	•	They are not executable constraints.

A dead file requires a human to open it.

An agent cannot reliably use knowledge that:
	•	Lives in Slack
	•	Lives in Notion
	•	Lives in Google Docs
	•	Lives in someone’s head

From the agent’s perspective:

If it’s not in the repo, it doesn’t exist.

⸻

II. Living vs Dead Files

Dead File
	•	Static
	•	Unchecked
	•	Not referenced by tooling
	•	Not validated against code
	•	Can silently rot
	•	No mechanical enforcement
	•	Human-only awareness

Living File
	•	Versioned
	•	Referenced by agents
	•	Validated in CI
	•	Enforced by linters or structural tests
	•	Used as input to decisions
	•	Updated by automation
	•	Queried by agents
	•	Cross-linked
	•	Diff-aware
	•	Participates in feedback loops

A Living File is not documentation.

It is part of the control plane.

⸻

III. Living Files as Control System

In an agent-first environment, the repository becomes:
	•	Memory
	•	Constraint system
	•	Execution harness
	•	Feedback engine
	•	Governance layer

Living Files serve 5 roles:
	1.	Intent encoding
	2.	Constraint encoding
	3.	Architectural map
	4.	Quality ledger
	5.	Entropy counterweight

They must be:
	•	Small at entry
	•	Deep when expanded
	•	Mechanically validated
	•	Structured
	•	Cross-linked
	•	Discoverable

⸻

Allternit STRUCTURAL DOCTRINE

We will not copy their structure.

We will generalize it.

We build a structure that expands infinitely without becoming fragile.

⸻

Allternit REPOSITORY STRUCTURE (Harness-Native)

AGENTS.md
ARCHITECTURE.md
SOT.md

/spec/
  baseline/
  deltas/
  contracts/
  acceptance-tests/
  threat-model.md

/docs/
  design/
  exec/
  product/
  governance/
  quality/
  reliability/
  security/
  references/
  generated/

/runtime/
  observability/
  browser/
  metrics/
  traces/

/agent/
  policy.md
  roles/
  golden-principles.md
  review-protocol.md
  garbage-collection.md

/quality/
  domain-grades.md
  drift-log.md
  entropy-score.md

This is not decorative.

Each directory must be mechanized.

⸻

AGENTS.md (Table of Consciousness)

AGENTS.md must:
	•	Be under 120 lines.
	•	Act only as a map.
	•	Never contain operational detail.
	•	Link to authoritative sources.

It should:
	1.	Explain architectural layering.
	2.	Explain review loop.
	3.	Explain golden invariants.
	4.	Explain escalation protocol.
	5.	Point to SOT.md.

It must not:
	•	Duplicate content.
	•	Contain rules not enforced in code.
	•	Become encyclopedic.

⸻

ARCHITECTURE.md

This file must:
	•	Explain domain segmentation.
	•	Enforce dependency direction.
	•	Define allowed edges.
	•	Define forbidden edges.
	•	Define provider interfaces.
	•	Be lint-validated.

Agents must be able to:
	•	Read this file
	•	Map code to this file
	•	Detect violations

⸻

A2A REVIEW LOOP (Agent-to-Agent)

This must be formalized.

Required Roles
	1.	Implementer Agent
	2.	Reviewer Agent
	3.	Tester Agent
	4.	Security Agent
	5.	Policy Gate Agent
	6.	Garbage Collection Agent (background)

Flow
	1.	Implementer generates change.
	2.	Self-review loop.
	3.	Structural lint run.
	4.	Reviewer agent scans diff.
	5.	Tester agent runs deterministic harness.
	6.	Security agent scans boundaries.
	7.	Policy gate verifies invariants.
	8.	If clean → merge.
	9.	If violation → remediation prompt auto-generated.

Humans only intervene if:
	•	Architectural pivot required.
	•	Spec conflict.
	•	Ethical ambiguity.
	•	High-risk system change.

This becomes a deterministic state machine, not a chat loop.

⸻

UI + OBSERVABILITY LEGIBILITY STACK

Agents cannot fix what they cannot inspect.

Allternit must include:

1. Worktree-Isolated Execution
	•	Every task gets its own runtime instance.
	•	Isolated logs.
	•	Isolated metrics.
	•	Isolated traces.
	•	Destroyed post-merge.

2. Browser Control Layer

Capabilities:
	•	DOM snapshot
	•	Screenshot capture
	•	Navigation automation
	•	Interaction replay
	•	Video capture for PR

3. Log Query Interface

Agents must:
	•	Query logs
	•	Filter by span
	•	Inspect structured logs
	•	Trace causality

4. Metrics Query

Agents must:
	•	Inspect response times
	•	Validate thresholds
	•	Compare pre/post changes

5. Performance Contracts

Example:
“Startup under 800ms”
“No span > 2s”
“Zero 500 errors in flow X”

These become mechanical assertions.

⸻

GARBAGE COLLECTION SYSTEM (Entropy Engine)

This is non-negotiable.

Agents replicate patterns.
Bad patterns multiply.

We need:

Golden Principles

Examples:
	•	Boundary validation required.
	•	No YOLO probing.
	•	Shared utilities over local duplication.
	•	Structured logging mandatory.
	•	File size limits.
	•	Dependency graph purity.

These must be encoded as:
	•	Custom linters
	•	Structural tests
	•	AST rules
	•	Policy gate checks

Background Cleanup Agents

Recurring tasks:
	•	Scan for invariant violations.
	•	Update quality scores.
	•	Refactor drifted patterns.
	•	Improve test coverage.
	•	Remove duplication.
	•	Flag doc staleness.

These generate small PRs.
Reviewable in under 1 minute.
Auto-merge when safe.

Garbage collection must run daily.

Not weekly.

⸻

QUALITY SCORE SYSTEM

We implement:

/quality/domain-grades.md

Each domain graded on:
	•	Architecture adherence
	•	Test coverage
	•	Observability completeness
	•	Boundary enforcement
	•	Drift frequency

This becomes visible to agents.

Agents optimize for grade.

⸻

LIVING FILE ENFORCEMENT RULES

Every major file must:
	•	Have an owner.
	•	Be versioned.
	•	Be referenced in CI.
	•	Have cross-links validated.
	•	Be checked for staleness.

Doc-gardener agent:
	•	Scans for outdated references.
	•	Compares code behavior to doc claims.
	•	Opens fix PRs.

⸻

HARNESS FIRST, NOT PROMPT FIRST

Agent Studio must shift from:

“Create prompt”

To:

“Define environment constraints”

This means Studio should:
	•	Generate structural invariants
	•	Define role permissions
	•	Attach contracts
	•	Attach observability requirements
	•	Attach review pipeline
	•	Attach entropy control rules

Prompts are secondary.

Harness is primary.

⸻

WHAT THIS MEANS FOR Allternit STRATEGY

You are not building:

A prompt tool.

You are building:

A Harness Operating System.

Core layers now must prioritize:
	1.	Observability exposure.
	2.	Deterministic review pipeline.
	3.	Structural lint engine.
	4.	Garbage collection automation.
	5.	Progressive documentation enforcement.

Marketplace can wait.

Autonomy ceiling cannot.

⸻

FINAL CLARITY

Living Files are:

Executable knowledge artifacts that participate in feedback loops.

A2A review is:

Deterministic agent role orchestration over diffs.

UI + Observability Legibility is:

Turning runtime behavior into machine-readable state.

Garbage Collection is:

Continuous entropy compression.

This is the architecture tier that survives model upgrades.

⸻

Good. We formalize everything.

Below are five repo-ready canonical documents, written as system-level doctrine/specs. These are not blog explanations. These are implementation-oriented control-plane documents.

You can drop these directly into Allternit and evolve them.

⸻

1️⃣ Allternit Living Files Doctrine

File: /docs/governance/LIVING_FILES_DOCTRINE.md

⸻

Allternit Living Files Doctrine v1.0

1. Premise

In an agent-first system, the repository is not storage.

It is the cognitive substrate.

Anything not present in the repository is invisible to agents and therefore operationally nonexistent.

The repository must function as:
	•	Memory
	•	Constraint system
	•	Intent encoding layer
	•	Enforcement engine
	•	Feedback surface
	•	Entropy counterweight

Documentation is not explanatory.
It is executable context.

⸻

2. Definition

A Living File is a versioned artifact that:
	1.	Is referenced by agents during execution.
	2.	Is validated mechanically (CI, lint, contract test, or policy gate).
	3.	Influences behavior or decision-making.
	4.	Is subject to drift detection.
	5.	Can trigger automated remediation.

A file that does not meet these properties is dead.

Dead files are entropy.

⸻

3. Living File Categories

A. Intent Files
	•	/spec/baseline/*
	•	/spec/deltas/*
	•	/docs/product/*
	•	/docs/exec/*

Purpose:
Define what should exist.

Validation:
	•	Linked to acceptance tests.
	•	Checked for completeness.
	•	Checked for ownership.

⸻

B. Constraint Files
	•	/agent/policy.md
	•	/agent/golden-principles.md
	•	/ARCHITECTURE.md
	•	/spec/contracts/*

Purpose:
Define invariants.

Validation:
	•	Structural lint.
	•	Contract enforcement.
	•	Dependency graph analysis.

⸻

C. Quality Ledger Files
	•	/quality/domain-grades.md
	•	/quality/entropy-score.md
	•	/docs/QUALITY_SCORE.md

Purpose:
Measure coherence and drift.

Validation:
	•	Automatically updated.
	•	Referenced by garbage collection agents.

⸻

D. Runtime Legibility Files
	•	/runtime/observability/*
	•	/runtime/metrics/*
	•	/runtime/traces/*

Purpose:
Expose system behavior to agents.

Validation:
	•	Queryable via deterministic interface.
	•	Snapshotable per worktree.

⸻

E. Generated Living Files
	•	/docs/generated/*
	•	/spec/generated/*

Purpose:
Machine-produced knowledge artifacts.

Validation:
	•	Regenerated deterministically.
	•	Checked against source truth.

⸻

4. Living File Enforcement Rules

Every Living File must:
	•	Declare owner.
	•	Declare verification mechanism.
	•	Declare refresh cadence.
	•	Declare dependent artifacts.

No file may exist without a declared validation surface.

⸻

5. Drift Protocol

Drift is defined as:
Difference between encoded intent and observable behavior.

Detection mechanisms:
	•	Doc-gardener agent
	•	Structural lint
	•	Contract test
	•	Runtime invariant violation
	•	Entropy score regression

Resolution:
Drift is corrected by agent PR within 24 hours.

⸻

6. Core Principle

If a human says:
“We agreed on that in Slack.”

It must be encoded into a Living File or it does not exist.

⸻

End of Doctrine.

⸻

2️⃣ A2A Deterministic Review State Machine

File: /agent/review-protocol.md

⸻

Allternit Agent-to-Agent Review Protocol v1.0

1. Roles
	•	Implementer
	•	Self-Reviewer
	•	Structural Reviewer
	•	Tester
	•	Security Reviewer
	•	Policy Gate
	•	Garbage Collector (background)

Each role has:
	•	Tool allowlist
	•	Scope permissions
	•	Failure escalation rules

⸻

2. State Machine

STATE: TASK_CREATED
→ IMPLEMENTATION_RUNNING
→ SELF_REVIEW
→ STRUCTURAL_VALIDATION
→ TEST_EXECUTION
→ SECURITY_SCAN
→ POLICY_EVALUATION
→ MERGE_READY
→ MERGED

Failure at any stage returns to IMPLEMENTATION_RUNNING with structured remediation instructions.

⸻

3. Stage Definitions

IMPLEMENTATION_RUNNING
	•	Generate change.
	•	Link to spec.
	•	Generate acceptance coverage.
	•	Attach runtime validation if applicable.

SELF_REVIEW
	•	Agent reviews diff.
	•	Flags style drift.
	•	Fixes trivial issues automatically.

STRUCTURAL_VALIDATION
	•	Dependency graph check.
	•	Architectural layering enforcement.
	•	File size constraints.
	•	Boundary validation enforcement.

TEST_EXECUTION
	•	Unit tests.
	•	Integration tests.
	•	Contract tests.
	•	Deterministic replay harness.

SECURITY_SCAN
	•	Input validation coverage.
	•	Secret exposure.
	•	Unauthorized dependency.
	•	Unsafe dynamic execution.

POLICY_EVALUATION
	•	Golden principle compliance.
	•	Naming invariants.
	•	Logging structure enforcement.
	•	Observability presence.

⸻

4. Escalation Rules

Human required only if:
	•	Spec conflict.
	•	Architectural violation requiring re-design.
	•	Risk tier exceeds threshold.
	•	Ethical/legal ambiguity.

⸻

5. Merge Philosophy
	•	Short PR lifecycle.
	•	Retry preferred over stall.
	•	Automated remediation preferred over block.
	•	Drift resolved incrementally.

⸻

End Protocol.

⸻

3️⃣ Observability Interface Contract

File: /runtime/observability/OBSERVABILITY_CONTRACT.md

⸻

Allternit Observability Legibility Contract v1.0

1. Purpose

Agents must be able to inspect runtime state deterministically.

If behavior cannot be queried, it cannot be corrected.

⸻

2. Required Surfaces

Each worktree must expose:
	1.	Structured logs
	2.	Metrics
	3.	Traces
	4.	UI state
	5.	Performance stats

All must be:
	•	Queryable via deterministic API.
	•	Namespaced per task.
	•	Destroyed post-merge.

⸻

3. Log Requirements
	•	Structured JSON.
	•	Mandatory correlation IDs.
	•	Domain-tagged.
	•	Queryable via LogQL-like interface.

⸻

4. Metrics Requirements
	•	Response time per endpoint.
	•	Error rate.
	•	Resource usage.
	•	Domain-specific invariants.

Queryable via PromQL-like interface.

⸻

5. Trace Requirements
	•	Span per major action.
	•	Max span duration constraints.
	•	Cross-domain trace continuity.

⸻

6. UI Legibility

Agents must be able to:
	•	Capture DOM snapshot.
	•	Capture screenshot.
	•	Record interaction replay.
	•	Compare before/after state.

⸻

7. Performance Contracts

Example:
	•	Startup < 800ms
	•	No critical span > 2s
	•	Zero 500s in onboarding flow

These must be encoded as executable assertions.

⸻

End Contract.

⸻

4️⃣ Garbage Collection Engine Spec

File: /agent/garbage-collection.md

⸻

Allternit Entropy Compression Engine v1.0

1. Premise

Agents replicate patterns.

Uncorrected drift compounds exponentially.

Entropy must be continuously compressed.

⸻

2. Golden Principles
	•	No unvalidated external data.
	•	Boundary parsing required.
	•	Shared utilities over duplication.
	•	Structured logging mandatory.
	•	No silent catch.
	•	Max file size threshold.
	•	Strict dependency direction.

⸻

3. Garbage Collection Agents

Run daily.

Tasks:
	1.	Detect duplicate utilities.
	2.	Detect untyped boundary usage.
	3.	Detect dependency violations.
	4.	Detect missing observability.
	5.	Detect stale documentation.
	6.	Improve test coverage gaps.

Each produces:
Small PR.
Auto-merge if safe tier.

⸻

4. Entropy Score

Entropy is calculated from:
	•	Rule violations.
	•	Drift rate.
	•	Test coverage delta.
	•	Documentation mismatch.

Score is recorded in:
/quality/entropy-score.md

⸻

5. Principle

Technical debt is a high-interest loan.

Pay daily.

Never batch.

⸻

End Spec.

⸻

5️⃣ Harness Blueprint Integration Document

File: /docs/design/ALLTERNIT_HARNESS_BLUEPRINT.md

⸻

Allternit Harness Blueprint v1.0

1. Layered Architecture

Human Layer
↓
Spec Layer
↓
Execution Kernel
↓
A2A Review Engine
↓
Observability Layer
↓
Garbage Collection Engine
↓
Repository State


⸻

2. Execution Kernel

Must include:
	•	WIH loader
	•	Role-scoped permissions
	•	DAG enforcement
	•	Tool contract registry
	•	Policy gate
	•	Deterministic context builder
	•	Receipt emitter

⸻

3. Review Engine

Implements deterministic state machine from /agent/review-protocol.md.

⸻

4. Legibility Stack

Integrates:
	•	Worktree isolation
	•	Observability contract
	•	Browser automation
	•	Performance assertions

⸻

5. Entropy Layer

Runs in background.

Maintains:
	•	Golden principles
	•	Quality grades
	•	Drift repair
	•	Refactor cadence

⸻

6. Strategic Positioning

Allternit is not:

A prompt tool.

Allternit is:

Harness Operating System for Agentic Software Development.

Model upgrades increase speed.
Harness quality determines ceiling.

⸻
