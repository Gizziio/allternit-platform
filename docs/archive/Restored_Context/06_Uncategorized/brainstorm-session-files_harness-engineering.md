Here’s a rigorous precis of the Martin Fowler article you linked on “Harness Engineering” — describing concrete ideas about structuring and governing AI-assisted software engineering workflows (from the “Exploring Gen AI” series on martinfowler.com):  ￼

⸻

Core thesis

The author discusses harness engineering as a set of practices and tooling to ensure that AI agents (LLMs) can operate safely, predictably, and sustainably over the lifetime of a real software product — especially when agents generate and maintain large codebases.  ￼

This concept originated from an OpenAI write-up describing a team that built a product over ~5 months with no manually typed code at all, instead relying on AI agents guided by a harness — infrastructure that both assists and constrains those agents.  ￼

⸻

What a harness actually consists of

The article structures the harness tooling and constraints into three high-level components:  ￼
	1.	Context engineering
Continuously evolving structured knowledge used to inform AI agents:
• Knowledge base integrated into the codebase
• External context like observability data and browser navigation for agents to utilize  ￼
	2.	Architectural constraints
Not just LLM output validation, but deterministic checks — custom linters and structural tests that enforce explicit architectural boundaries and rules.  ￼
	3.	“Garbage collection” agents
Dedicated routines that run periodically to:
• Detect documentation drift
• Find violations of architectural constraints
• Maintain internal consistency
These agents fight natural entropy in a codebase.  ￼

Across all these, the focus is on long-term quality and maintainability, not just short-term productivity.  ￼

⸻

Iterative feedback loop

A central pattern described in the article is:

When an agent fails or struggles, treat that failure as a signal to identify missing tooling or guardrails. Then feed those back into the system — often with the help of AI itself.  ￼

This makes the harness an adaptive control loop, not a static template.  ￼

⸻

Constraints as first-class design

The author emphasizes:
	•	Maintainability at scale requires constraining the solution space — not limitless code generation.
That means enforcing patterns, standard stacks, fixed boundaries, and stable data structures so AI output stays predictable.  ￼
	•	Without these constraints, unfettered LLM output leads to unmanageable variability that undermines trust in a codebase.  ￼

This is essentially the inverse of most early “AI will code anything” thought experiments: for sustainable AI autonomy, you give up unconstrained flexibility in favor of rigorous scaffolding.  ￼

⸻

Strategic implications

From a systems perspective, the article suggests:
	•	Future engineering toolchains may converge on standard harness templates for common application topologies, akin to service templates in platform engineering.  ￼
	•	Teams will likely choose stacks and patterns that are easier to harness (i.e., more predictable under autonomous agent workflows).  ￼
	•	Retrofitting a harness onto legacy systems is costly and might be less effective than designing from the ground up with harness-friendly structures.  ￼
	•	Proper harness design involves significant deterministic tooling and architectural work — not just prompt engineering or metadata files.  ￼

⸻

Summary (condensed)

Harness engineering = infrastructure + constraints + adaptive tooling that govern AI agents so that:
	•	the codebase remains maintainable,
	•	architectural invariants are enforced systematically,
	•	agents can operate with transparency and control over time.

It reframes AI-assisted development from trial/error prompt hacking toward discipline-oriented engineering practice with layered checks and feedback loops.  ￼


You are building an agent operating system.
That means the harness must be first-class infrastructure — not an afterthought.

Below is a Harness Engineering Blueprint tailored specifically for A://TERNIT.

⸻

A://TERNIT Harness Engineering Blueprint

0. Objective

Create a deterministic control layer that allows:
	•	Autonomous agents to write code
	•	Agents to review code
	•	Architecture invariants to be enforced automatically
	•	Failures to generate permanent system improvements
	•	Drift to be detected and corrected
	•	Large multi-agent swarms to operate safely

This must integrate with:
	•	/SOT.md
	•	/spec baseline + Deltas
	•	/agent/POLICY.md
	•	Contracts
	•	AcceptanceTests.md
	•	Repo Law vNext
	•	WIH headers
	•	CODEBASE.md anchor

The harness is the enforcement plane of your law layer.

⸻

1. Allternit Harness Topology

Think in planes.

1️⃣ Specification Plane (Truth Layer)

Immutable references:
	•	/SOT.md
	•	/spec/Vision.md
	•	/spec/Requirements.md
	•	/spec/Architecture.md
	•	/spec/Contracts/
	•	/spec/AcceptanceTests.md
	•	/spec/Deltas/ (append-only)

This is not optional context.

Agents must:
	•	Load SOT
	•	Load POLICY
	•	Load relevant Contracts
	•	Attach WIH header

Every task must reference:
	•	Spec section ID
	•	Contract ID
	•	Acceptance test ID

If not → reject execution.

This eliminates speculative coding.

⸻

2️⃣ Context Engineering Layer

Agents fail because context is incomplete.

So we formalize context ingestion.

Allternit Context Pack Generator

Before any major task:

Generate:
	•	CODEBASE summary (from CODEBASE.md)
	•	Architecture snapshot
	•	Active Deltas
	•	Relevant Contracts
	•	Test harness summary
	•	Change history (CHANGEPOINTS.md)

This becomes:

/.context_pack/task_<id>.md

Agents cannot execute without it.

No “naked prompting.”

⸻

3️⃣ Deterministic Guardrail Layer

This is where most systems fail.

You must enforce structure with machine validation, not LLM judgment.

A. Structural Linters

Create custom validators:
	•	WIH header presence
	•	Spec reference present
	•	No cross-boundary imports
	•	No unapproved path edits
	•	No dependency injection without ADR
	•	Contract adherence validation
	•	Tool usage permission validation

These run in:
	•	Pre-commit hook
	•	CI pipeline
	•	PR validation

Agents cannot merge without passing.

⸻

B. Risk Tier Enforcement

Define risk tiers:

Tier	Description	Requires
0	Docs only	CI lint
1	Internal logic	Unit tests
2	Cross-service change	Contract tests
3	Security-impacting	Security review agent
4	Destructive	Human approval

Agent must declare risk tier in WIH.

Harness validates declared tier against diff pattern.

Mismatch → reject.

⸻

4️⃣ Tool Harness Layer

Every tool must have:
	•	Typed schema
	•	Safety level
	•	Preconditions
	•	Path constraints

No raw shell access.

Wrap everything.

Example:

Instead of:

exec("rm -rf ...")

You provide:

filesystem_delete(path, reason, ticket_id)

Security agent validates:
	•	Path
	•	Spec reference
	•	Approval requirement

You never let the LLM directly issue destructive commands.

⸻

5️⃣ Agent Role Isolation

You already define roles:
	•	Architect
	•	Implementer
	•	Tester
	•	Reviewer
	•	Security

Harness must enforce:

Role	Allowed Actions
Architect	Edit /spec only
Implementer	Code changes only
Tester	Write tests only
Reviewer	Comment only
Security	Gate destructive tools

Reviewer cannot modify code.
Implementer cannot modify spec.
Security cannot write features.

This prevents self-approval loops.

⸻

6️⃣ Adaptive Feedback Loop (Core of Harness Engineering)

Every failure must become:
	•	New lint rule
	•	New acceptance test
	•	New contract constraint
	•	New tool wrapper

Never patch manually.

Flow:

Agent failure →
Root cause analysis →
Harness upgrade →
Re-run task.

The harness must grow over time.

You are not optimizing prompts.

You are optimizing the control plane.

⸻

7️⃣ Garbage Collection Agents

Entropy accumulates.

Schedule periodic agents to:
	•	Detect spec drift
	•	Detect dead files
	•	Detect unused modules
	•	Detect contract violations
	•	Detect duplicate logic
	•	Validate documentation against code

These run weekly.

Output goes to:

/spec/Deltas/drift_<timestamp>.md

Nothing decays silently.

⸻

8️⃣ Evidence-Based Merge

Merge requires:
	•	Passing tests
	•	Passing structural lint
	•	Passing contract validation
	•	Reviewer agent approval
	•	Security gate (if applicable)
	•	Traceable link to WIH + Spec

Each PR produces:

/evidence/pr_<id>.json

Including:
	•	Spec refs
	•	Tests executed
	•	Tool calls used
	•	Risk tier
	•	Reviewer notes

Everything machine-verifiable.

⸻

9️⃣ Harness for Agent Swarms

Since Allternit is multi-agent:

You must add:
	•	Swarm Scheduler validation
	•	DAG integrity checker
	•	Retry guard
	•	Circuit breaker
	•	Backpressure controller
	•	Node registry health monitor

If you don’t enforce:
	•	Agent loops
	•	Recursive failures
	•	Tool thrashing
	•	Memory overload
	•	Context corruption

Your audit earlier showed missing state machine and retry system.

Those must live in the harness layer, not the kernel alone.

⸻

10️⃣ Allternit Harness Minimal Implementation Plan

Phase 1:
	•	Enforce WIH validation
	•	Enforce spec reference
	•	Enforce role isolation
	•	Add structural lint
	•	Add CI gate

Phase 2:
	•	Add contract validation
	•	Add risk tier enforcement
	•	Add evidence JSON artifacts
	•	Add reviewer agent gate

Phase 3:
	•	Add garbage collector agents
	•	Add drift detection
	•	Add swarm control validators
	•	Add circuit breaker

Phase 4:
	•	Add automated harness evolution system
	•	Add failure pattern learning
	•	Add policy auto-updater (Meta Agent)

⸻

What This Achieves

You move from:

“Agents write code.”

to

“Agents operate inside a law-enforced deterministic environment.”

This is how you get:
	•	1000+ agents
	•	No entropy collapse
	•	No spec drift
	•	No hidden architecture erosion
	•	Machine-verifiable governance
	•	True autonomous engineering cloud

⸻

Brutal Truth

Without harness engineering:

Allternit becomes:
	•	A prompt shell
	•	A chaos machine
	•	A slow technical debt generator

With harness engineering:

Allternit becomes:
	•	An autonomous engineering operating system
	•	A deterministic AI production environment
	•	A scalable agent civilization

⸻

<harness layer directory structure>
1) Harness layer directory structure (repo-native)

allternit/
├── SOT.md
├── CODEBASE.md
├── CHANGEPOINTS.md
├── spec/
│   ├── Vision.md
│   ├── Requirements.md
│   ├── Architecture.md
│   ├── AcceptanceTests.md
│   ├── Contracts/
│   └── Deltas/
├── agent/
│   ├── POLICY.md
│   ├── ROLE_MATRIX.md
│   └── TOOLS_REGISTRY.json
├── evidence/
│   ├── runs/
│   │   └── run_<run_id>.json
│   ├── prs/
│   │   └── pr_<pr_id>.json
│   └── drift/
│       └── drift_<ts>.json
├── context_packs/
│   └── task_<wih_id>.md
├── harness/
│   ├── README.md
│   ├── schemas/
│   │   ├── wih.schema.json
│   │   ├── tool_call.schema.json
│   │   ├── evidence.schema.json
│   │   └── contract_ref.schema.json
│   ├── policies/
│   │   ├── risk_tiers.yaml
│   │   ├── boundaries.yaml
│   │   └── allowlists.yaml
│   ├── lints/
│   │   ├── wih_lint.rs
│   │   ├── boundary_lint.rs
│   │   ├── contract_lint.rs
│   │   └── docs_drift_lint.rs
│   ├── gc_agents/
│   │   ├── drift_sweep.md
│   │   ├── dead_code_sweep.md
│   │   └── docs_sync_sweep.md
│   └── ci/
│       ├── github/
│       │   └── workflows/
│       │       └── allternit_harness.yml
│       └── scripts/
│           ├── allternit-validate-wih
│           ├── allternit-validate-boundaries
│           ├── allternit-validate-contracts
│           └── allternit-emit-evidence
└── kernel/
    └── ... (runtime, runner, supervision, etc.)

Key invariants:
	•	All “agent work” is gated by WIH + Spec refs + Policy + Contracts + Acceptance tests.
	•	All merges emit evidence artifacts into evidence/.

⸻

2) Rust module map (implementation skeleton)

Target crate: kernel/infrastructure/allternit-harness (or domains/kernel/infrastructure/allternit-harness)

allternit-harness/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── wih/
    │   ├── mod.rs
    │   ├── parser.rs
    │   ├── validator.rs
    │   └── scope.rs
    ├── policy/
    │   ├── mod.rs
    │   ├── role_matrix.rs
    │   ├── risk_tiers.rs
    │   ├── allowlists.rs
    │   └── engine.rs
    ├── tool/
    │   ├── mod.rs
    │   ├── registry.rs
    │   ├── schema.rs
    │   ├── wrapper.rs
    │   └── preconditions.rs
    ├── contracts/
    │   ├── mod.rs
    │   ├── resolver.rs
    │   ├── validator.rs
    │   └── compatibility.rs
    ├── context_pack/
    │   ├── mod.rs
    │   ├── builder.rs
    │   ├── sources.rs
    │   └── snapshot.rs
    ├── lints/
    │   ├── mod.rs
    │   ├── wih_lint.rs
    │   ├── boundary_lint.rs
    │   ├── contract_lint.rs
    │   └── docs_drift_lint.rs
    ├── evidence/
    │   ├── mod.rs
    │   ├── emitter.rs
    │   ├── models.rs
    │   └── signer.rs
    ├── state/
    │   ├── mod.rs
    │   ├── lifecycle.rs
    │   ├── transitions.rs
    │   └── guards.rs
    └── gc/
        ├── mod.rs
        ├── drift_sweep.rs
        ├── dead_code_sweep.rs
        └── docs_sync_sweep.rs

Minimal public API (what your runtime calls):

pub struct Harness;

impl Harness {
  pub fn preflight(task_wih_path: &str) -> Result<PreflightBundle, HarnessErr>;
  pub fn guard_tool_call(call: ToolCall) -> Result<ToolCall, HarnessErr>;
  pub fn post_tool_call(receipt: ToolReceipt) -> Result<(), HarnessErr>;
  pub fn finalize(run: RunSummary) -> Result<EvidenceRef, HarnessErr>;
}


⸻

3) State machine for agent task lifecycle (deterministic)

States
	•	INIT — task accepted, no side effects
	•	LOAD_TRUTH — load /SOT.md, /agent/POLICY.md, relevant /spec/*
	•	PARSE_WIH — parse WIH header + enforce required fields
	•	BUILD_CONTEXT_PACK — emit /context_packs/task_<id>.md
	•	PLAN — DAG plan produced; must include spec refs + acceptance mapping
	•	PRECHECKS — run lints, boundary checks, contract checks (no tools yet)
	•	EXECUTE — tool calls allowed only via harness wrapper
	•	VERIFY — run tests/contract tests per risk tier
	•	REVIEW — reviewer agent generates approval record (no code writes)
	•	SECURITY_GATE — only if tier ≥ 3 or tools flagged
	•	EMIT_EVIDENCE — write evidence JSON
	•	COMPLETE — done
	•	REJECTED — failed guard; no side effects beyond logs
	•	ABORTED — circuit breaker, timeout, or policy violation mid-run

Transition guards (examples)
	•	INIT -> LOAD_TRUTH only if task has wih_id
	•	LOAD_TRUTH -> PARSE_WIH only if SOT + POLICY loaded successfully
	•	PARSE_WIH -> BUILD_CONTEXT_PACK only if WIH validates against schema
	•	PRECHECKS -> EXECUTE only if:
	•	role permitted
	•	risk tier consistent with diff intent
	•	boundaries OK
	•	contracts resolvable
	•	EXECUTE -> VERIFY only if tool receipts show no policy violations
	•	VERIFY -> REVIEW only if required tests pass for risk tier
	•	REVIEW -> SECURITY_GATE only if tier triggers it; else -> EMIT_EVIDENCE
	•	SECURITY_GATE -> EMIT_EVIDENCE only if security agent output is “PASS”
	•	EMIT_EVIDENCE -> COMPLETE only if evidence schema validates

Circuit breakers
	•	Max tool calls per phase
	•	Max retries per tool
	•	Max tokens per agent step (if you have token budgeting)
	•	Timeouts per state

⸻

4) CI scaffold (GitHub Actions) with harness gates

Create: harness/ci/github/workflows/allternit_harness.yml

name: Allternit Harness Gates

on:
  pull_request:
  push:
    branches: [ main ]

jobs:
  harness-gates:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install jq
        run: sudo apt-get update && sudo apt-get install -y jq

      - name: Validate WIH headers
        run: |
          ./harness/ci/scripts/allternit-validate-wih

      - name: Validate repo boundaries
        run: |
          ./harness/ci/scripts/allternit-validate-boundaries

      - name: Validate contract references
        run: |
          ./harness/ci/scripts/allternit-validate-contracts

      - name: Run unit tests
        run: |
          cargo test --workspace

      - name: Emit evidence (dry-run for CI)
        env:
          GITHUB_SHA: ${{ github.sha }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
        run: |
          ./harness/ci/scripts/allternit-emit-evidence --mode ci --out /tmp/evidence.json
          jq '.' /tmp/evidence.json >/dev/null

      - name: Upload evidence artifact
        uses: actions/upload-artifact@v4
        with:
          name: allternit-evidence
          path: /tmp/evidence.json

What your scripts should do (contract):
	•	allternit-validate-wih: fail if any changed file lacks required WIH header (or if tasks require WIH file)
	•	allternit-validate-boundaries: diff-based boundary enforcement (imports + path rules)
	•	allternit-validate-contracts: ensure referenced contracts exist and are syntactically valid
	•	allternit-emit-evidence: produce JSON per harness/schemas/evidence.schema.json

⸻

5) Paste-ready “Implementation Agent” prompt (for your coding model)

ROLE
You are the Allternit Harness Implementer. You may only change code under:
- kernel/infrastructure/allternit-harness/**
- harness/**
- agent/TOOLS_REGISTRY.json (if required for typed wrappers)
You may NOT change /spec except to ADD a Delta file when required by POLICY.

CONTEXT (MUST LOAD FIRST)
1) /SOT.md
2) /agent/POLICY.md
3) /agent/ROLE_MATRIX.md
4) /spec/Architecture.md
5) /spec/AcceptanceTests.md
6) harness/schemas/*.json
7) CODEBASE.md

TASK
Implement the harness gates as a deterministic library + CI scripts:
A) WIH parser + JSON-schema validator (harness/schemas/wih.schema.json)
B) Policy engine enforcing role isolation + risk tier (harness/policies/*.yaml)
C) Tool registry wrapper enforcing schema + preconditions
D) Evidence emitter writing evidence/runs/run_<id>.json with schema validation
E) Minimal CLI scripts:
   - harness/ci/scripts/allternit-validate-wih
   - harness/ci/scripts/allternit-validate-boundaries
   - harness/ci/scripts/allternit-validate-contracts
   - harness/ci/scripts/allternit-emit-evidence
F) Add GitHub Actions workflow harness/ci/github/workflows/allternit_harness.yml

HARD RULES
- No new dependencies unless strictly necessary; if added, justify in a Delta + ADR file path if required by POLICY.
- All outputs must be deterministic.
- All failures must be explicit and actionable error messages.
- Reviewer role is comment-only; enforce it in policy engine tests.
- Provide unit tests for WIH validation and policy enforcement.

ACCEPTANCE
- CI passes on a clean repo.
- A PR lacking WIH or breaking boundaries fails CI.
- Evidence JSON artifact is generated and validates.
Deliver: a single PR-ready diff with tests.


⸻

6) Formal spec document to place in /spec (drop-in)

Create: /spec/HarnessEngineering.md

# Allternit Harness Engineering

## 1. Purpose
The Allternit Harness is the deterministic enforcement layer that governs agent execution, tool use, architectural constraints, and merge eligibility. It ensures autonomous work remains maintainable, auditable, and aligned with the system Source of Truth (SOT) and Repo Law.

## 2. Scope
The Harness applies to:
- All agent-driven code changes
- All tool invocations performed by agents
- CI/merge gates for any repository changes
- Periodic garbage-collection (drift detection and cleanup)

Out of scope:
- Model selection, inference hosting, and provider billing
- UI/UX design of the Allternit shell (except evidence display surfaces)

## 3. Canonical Truth Inputs
The harness must treat the following as authoritative:
- `/SOT.md`
- `/agent/POLICY.md`
- `/agent/ROLE_MATRIX.md`
- `/spec/*` (Vision, Requirements, Architecture, AcceptanceTests)
- `/spec/Contracts/*`
- `/spec/Deltas/*` (append-only constraints and changes)

If any required truth input is missing or unreadable, execution MUST be rejected.

## 4. Work Item Header (WIH)
All agent work MUST be anchored by a WIH object containing:
- wih_id
- role (Architect | Implementer | Tester | Reviewer | Security)
- scope_paths (allowed edit roots)
- spec_refs (section IDs or file anchors)
- contract_refs (optional but required for cross-boundary changes)
- acceptance_refs (tests or acceptance sections)
- risk_tier (0..4)

The WIH MUST validate against `harness/schemas/wih.schema.json`.

## 5. Role Isolation
The harness MUST enforce role permissions:
- Architect: modify spec only (and Deltas when policy allows)
- Implementer: modify code only within declared scope_paths
- Tester: modify tests only
- Reviewer: comment-only (no file writes)
- Security: gate destructive tools and tier≥3 changes

Violation MUST reject execution and emit evidence.

## 6. Risk Tier Model
Risk tier determines required checks and approvals:

Tier 0 (Docs): lint + schema validation  
Tier 1 (Local): unit tests required  
Tier 2 (Cross-boundary): contract tests + boundary validation required  
Tier 3 (Security-impacting): security agent approval required  
Tier 4 (Destructive/irreversible): human approval required

The harness MUST detect tier mismatch between declared tier and observed diffs/tool usage.

## 7. Architectural Boundaries
The harness MUST enforce boundaries defined in `harness/policies/boundaries.yaml`:
- Path-based edit constraints
- Import constraints (no forbidden cross-service imports)
- Contract-required call paths for inter-service communication

Boundary violations MUST fail CI.

## 8. Tool Contract Layer
All tools MUST be registered with:
- Typed schema (inputs/outputs)
- Safety level (read-only | write | destructive)
- Preconditions (required refs, required tier, approvals)

All tool calls MUST pass through the wrapper that:
- Validates schema
- Checks policy preconditions
- Produces receipts
- Denies unsafe usage

## 9. Evidence and Auditability
Each run MUST emit an evidence record:
- Inputs loaded (SOT hash, POLICY hash, spec refs)
- WIH content + validation result
- Tool call receipts (sanitized)
- Checks executed and outcomes (lints/tests/contracts)
- Approvals (review/security/human if applicable)
- Final status (complete/rejected/aborted)

Evidence MUST validate against `harness/schemas/evidence.schema.json` and be written to:
- `evidence/runs/run_<run_id>.json`
- For PRs, `evidence/prs/pr_<pr_id>.json`

## 10. Garbage Collection Agents
On a schedule, GC agents MUST:
- Detect documentation drift vs code
- Detect dead or duplicate modules
- Detect boundary violations missed by localized checks
- Produce drift reports and (optionally) spec deltas

Outputs:
- `evidence/drift/drift_<timestamp>.json`
- Optional: `/spec/Deltas/drift_<timestamp>.md`

## 11. CI Gates
CI MUST run:
- WIH validation
- Boundary validation
- Contract reference validation
- Tests per risk tier
- Evidence emission (at least CI mode)

A change that fails any gate MUST be non-mergeable.

## 12. Non-Functional Requirements
- Deterministic: same inputs → same outputs
- Explainable failures: actionable messages
- Minimal dependency surface
- Secure by default: deny unless explicitly allowed
- Composable: works for single-agent and swarm DAG executions

## 13. Acceptance Criteria
- A PR missing required WIH/spec refs fails CI
- A boundary violation fails CI
- A cross-boundary change without contract refs fails CI
- Evidence artifact is produced and validates every run
- Reviewer role cannot write files
- Destructive tool calls require tier 4 + approval


⸻

