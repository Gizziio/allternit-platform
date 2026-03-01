A2rchitech Session Summary — Repo Law vNext + Deterministic Agent Framework (Under Development)

Date: 2026-01-26
Topic: Canonical repo law, WIH-driven agent boot, CODEBASE primacy, monorepo/submodule topology, deterministic agent operations for A2rchitech projects.

⸻

1. Core Objective

Establish a repo-native, enforceable agent framework for all A2rchitech projects that:
	•	Is deterministic across runs and agents
	•	Requires no hand-holding
	•	Scales to monorepos, hybrid repos, and multi-repo systems
	•	Prevents hallucinated interfaces via shared contract artifacts
	•	Uses Beads front matter (WIH) as the universal execution envelope
	•	Treats CODEBASE.md as a Tier-0 retrieval anchor
	•	Supports submodules/worktrees as intentional isolation boundaries
	•	Encodes a strict order-of-operations for agents

This is the default project bootstrap doctrine for users building on A2rchitech.

⸻

⸻

2. Locked Architectural Principles

2.1 WIH as Deterministic Entry Point

All agent sessions start from Beads front matter.

WIH responsibilities:
	•	Declares role, risk, allowed tools, and paths
	•	Lists canonical docs/contracts to load
	•	Pins repo law version
	•	Defines execution protocol
	•	References Beads graph nodes
	•	Specifies CODEBASE anchors
	•	Declares determinism attempts
	•	Requests graph sidecars (bv)

Invariant:

Agents must never begin by grepping the repo.
They load exactly what WIH specifies.

⸻

⸻

2.2 Repo Law Core Primitives

Unchanged foundational law:

Primitive	Purpose
/SOT.md	Repo operating constitution
/spec/*	Frozen baseline
/spec/Deltas/*	Append-only changes
/agent/POLICY.md	Tool/path/role gates
/spec/Contracts/*	Executable truth
/spec/AcceptanceTests.md	Definition of done


⸻

⸻

2.3 CODEBASE.md Is Tier-0

CODEBASE is elevated from “documentation” to:
	•	Primary navigation artifact
	•	Retrieval anchor for agents
	•	Alternative to blind grep/search
	•	Mandatory for any non-trivial work item

Derived files:
	•	CODEBASE.index.md
	•	CODEBASE.graph.md
	•	CHANGEPOINTS.md
	•	DOCS_INDEX.md

⸻

⸻

2.4 Shared Types via Contracts

Invariant:

All cross-layer types (UI ↔ services ↔ packages) originate from contracts.

Allowed:
	•	OpenAPI
	•	JSON Schema
	•	protobuf / IDL
	•	generated language bindings

Prohibited:
	•	duplicated DTOs
	•	UI shadow interfaces
	•	hand-copied models

CI must fail on divergence.

⸻

⸻

3. Repo Topology Doctrine

Three sanctioned modes:

Tier 1 — Pure Monorepo
	•	Unified workspace
	•	Shared contracts
	•	Lowest hallucination risk

Tier 2 — Hybrid Monorepo + Submodules
	•	Root repo = command center
	•	Contracts + tooling live at root
	•	Submodules for:
	•	regulatory boundaries
	•	licensing
	•	lifecycle separation
	•	vendor forks

Submodule rules:
	•	Declared in /SOT.md
	•	Must expose local AGENT.md
	•	Cannot redefine shared contracts

Tier 3 — Multi-Repo
	•	Allowed only with:
	•	MCP context bridges
	•	unified CODEBASE packs
	•	orchestrator-supplied context sets

⸻

⸻

4. Canonical Agent Boot Model

4.1 WIH-Driven Boot Order (B0’)
	1.	Parse WIH
	2.	Load context_anchors
	3.	Validate role/tool/path gates
	4.	Load contracts
	5.	Execute protocol
	6.	Emit acceptance evidence

⸻

⸻

4.2 Agent Order of Operations (PAI-inspired)

Outer Loop:

observe → think → plan → build → execute → verify → learn

Determinism Ladder:

goal → code → cli → prompts → agents

Agents may only drop to higher-entropy tiers if deterministic layers are insufficient.

⸻

⸻

5. WIH vNext — Canonical Fields

wih_version: "1.0"
sot_version: "x.y.z"

repo_topology: pure_monorepo | hybrid_submodules | multi_repo

role: Researcher | Architect | Planner | Implementer | Tester | Reviewer | Security
risk_level: low | medium | high
requires_human_gate: false

order_of_operations:
  outer_loop: [observe, think, plan, build, execute, verify, learn]
  decision_ladder: [goal, code, cli, prompts, agents]

allowed_paths: []
forbidden_paths: []
tools_allowed: []

context_anchors:
  - path: "CODEBASE.md"
    sections: ["#0-tldr", "#4-architecture"]
  - path: "spec/Architecture.md"
  - path: "spec/Contracts/"
  - path: "agent/POLICY.md"

scope: ""
definition_of_done: []
acceptance_refs: []
contracts_touched: []

beads:
  id: "B-###"
  deps: []
  blocks: []
  unblocks: []
  criticality: auto
  graph_sidecar:
    tool: "bv"
    commands:
      insights: "bv --robot-insights"
      plan: "bv --robot-plan"
      priority: "bv --robot-priority"

determinism_attempts:
  code_attempted: false
  cli_attempted: false
  why_not_code_cli: ""


⸻

⸻

6. Automation & Enforcement Layer

CI / Pre-commit Gates
	•	WIH required
	•	CODEBASE refs required
	•	Forbidden paths blocked
	•	Contract versioning enforced
	•	Baseline spec changes require Delta or PIVOT
	•	Submodule violations blocked
	•	Determinism ladder violations flagged

⸻

Orchestrator Responsibilities
	•	Inject law bundle
	•	Enforce tool permissions
	•	Refuse illegal path edits
	•	Require acceptance refs
	•	Log violations

⸻

⸻

7. Agent Law Beacons

Root:
	•	/agent/AGENT.md
	•	/agent/POLICY.md
	•	/agent/OPERATIONS.md

Roles:
	•	/agent/roles/Architect.md
	•	/agent/roles/Implementer.md
	•	/agent/roles/Tester.md

Runbooks:
	•	/agent/runbooks/release.md
	•	/agent/runbooks/monorepo-changes.md
	•	/agent/runbooks/migrations.md

Subtrees:

Each service/package/app may include:
	•	AGENT.md
	•	BOUNDARIES.md
	•	CONTRACTS.md

⸻

⸻

8. Agent-Scripts / Ops Kit Pattern

From steipete/agent-scripts:

Adopt:
	•	Pointer-style AGENT files
	•	Centralized ops kit repo
	•	Docs indexing commands
	•	Commit helpers
	•	Submodule beacon enforcement
	•	Browser tools as fallback automation

Mirror this into A2rchitech as a pinned Law + Tooling Pack.

⸻

⸻

9. This Session’s Net-New Additions
	•	WIH promoted to primary agent boot surface
	•	CODEBASE elevated to Tier-0
	•	Determinism ladder formalized
	•	Hybrid submodule topology sanctioned
	•	MCP context bridging mandated for multi-repo
	•	bv graph sidecar integrated into WIH
	•	Agent-scripts pattern adopted
	•	PAI operational ordering incorporated

⸻

⸻

Status

🟡 Framework is still under development
This session locks direction + primitives for how A2rchitech bootstraps projects for users.

Future sessions will extend:
	•	migration playbooks
	•	repo bootstrap generators
	•	law bundle versioning
	•	enforcement tooling
	•	agent orchestration policies
	•	default starter templates

⸻

Saved for canonical A2rchitech buildout consolidation.
Got you — you’re right. The last summary was too thin relative to how much architectural ground we actually covered.

Below is a fully expanded, verbose, canonical A2rchitech Session Save that captures:

• Repo Law vNext
• WIH as deterministic Beads front-matter
• CODEBASE elevation
• Protocol Layer + RCP-001
• Submodules + hybrid topology
• Context bridging (MCP / multi-repo)
• agent-scripts patterns
• Miessler PAI order-of-operations
• Determinism ladder
• Enforcement automation
• CI gating
• Agent boot protocols
• Law beacons
• Shared-types doctrine
• Ops-kit mirror repo
• Doc-indexing + no-grep-first rule
• A2rchitech default bootstrap philosophy

Everything is merged into one verbose A2rchitech session artifact suitable for your canonical buildout thread.

⸻

A2rchitech Session Save — Repo Law vNext + Deterministic Agent Bootstrap

Status: Under Development
Purpose: Defines how A2rchitech initializes projects for users — repo topology, agent governance, boot protocols, deterministic execution, and enforcement surfaces.

⸻

⸻

1. Meta Goal of This Session

Design a universal project-bootstrap framework inside A2rchitech so that:

• Any repo becomes agent-operable immediately
• Context is deterministic, not discovered by wandering
• Agents are constrained by law, not suggestion
• Contracts prevent interface drift
• CODEBASE.md replaces blind grep
• Work items always carry execution context
• Monorepos and submodules coexist
• Multi-repo systems remain coherent
• CI enforces rules automatically
• Orchestrators inject compliance
• Users get production-grade structure by default

This is not task planning — it is platform doctrine.

⸻

⸻

2. Repo Law vNext — Foundational Layer

Repo Law vNext is the constitutional substrate for all A2rchitech repos.

⸻

2.1 Structural Primitives

Authoritative primitives:

Primitive	Role
/SOT.md	Repo constitution
/spec/*	Frozen baseline
/spec/Deltas/*	Append-only evolution
/agent/POLICY.md	Enforcement
/spec/Contracts/*	Executable truth
/spec/AcceptanceTests.md	Definition of done

Visual dividers (//====) are explicitly non-semantic.

⸻

⸻

2.2 Agent Boot Protocol (B0)

Agents load repo context in a stable path order:
	1.	/SOT.md
	2.	/agent/POLICY.md
	3.	/agent/OPERATIONS.md
	4.	/spec/Vision.md
	5.	/spec/Requirements.md
	6.	/spec/Architecture.md
	7.	/spec/Contracts/*
	8.	/spec/AcceptanceTests.md
	9.	newest /spec/Deltas/*
	10.	/agent/AGENTS.md

This is how agents “just know.”

⸻

⸻

3. WIH / Beads Front Matter — Deterministic Execution Envelope

WIH is the primary runtime context for every agent session.

Agents never start by exploring the repo.

They start from WIH.

⸻

3.1 WIH Responsibilities

WIH:

• pins repo law version
• defines topology
• lists docs to load
• names protocols
• includes determinism ladder
• references CODEBASE anchors
• enforces tool/path gates
• binds to Beads graph
• includes graph sidecars
• embeds playbook prompts
• records acceptance criteria

⸻

⸻

3.2 WIH Canonical Schema (Expanded)

wih_version: "1.0"
sot_version: "x.y.z"

repo_topology: pure_monorepo | hybrid_submodules | multi_repo

role: Researcher | Architect | Planner | Implementer | Tester | Reviewer | Security
risk_level: low | medium | high
requires_human_gate: false

order_of_operations:
  outer_loop: [observe, think, plan, build, execute, verify, learn]
  decision_ladder: [goal, code, cli, prompts, agents]

allowed_paths: []
forbidden_paths: []
tools_allowed: []

context_anchors:
  - path: "CODEBASE.md"
    sections: ["#0-tldr", "#4-architecture", "#11-how-to-change-safely"]
  - path: "spec/Architecture.md"
  - path: "spec/Contracts/"
  - path: "agent/POLICY.md"

scope: ""
definition_of_done: []
acceptance_refs: []
contracts_touched: []

beads:
  id: "B-###"
  deps: []
  blocks: []
  unblocks: []
  criticality: auto
  graph_sidecar:
    tool: "bv"
    commands:
      plan: "bv --robot-plan"
      insights: "bv --robot-insights"
      priority: "bv --robot-priority"

navigation_hints: []

determinism_attempts:
  code_attempted: false
  cli_attempted: false
  why_not_code_cli: ""


⸻

⸻

4. CODEBASE.md — Tier-0 Retrieval Artifact

CODEBASE.md is promoted to:

• onboarding index
• architectural map
• runbook
• API inventory
• change-safety manual
• agent retrieval anchor

Generated only via Repo Cartography Protocol (RCP-001).

Not hand-edited.

⸻

⸻

5. Protocol Layer — Executable Workflows

Protocols are not law.
They are how derived truth is generated.

⸻

5.1 Protocol Registry

/protocols/README.md


⸻

5.2 RCP-001 — Repo Cartography

Generates:

• CODEBASE.md
• CODEBASE.graph.md
• CHANGEPOINTS.md
• DOCS_INDEX.md

Requires:

• parallel agents
• evidence for every claim
• end-to-end flows
• “how to change safely”
• dependency graphs
• API inventories

⸻

⸻

6. Shared Types Doctrine

All shared types originate from contracts.

Allowed:
• OpenAPI
• JSON Schema
• protobuf

Forbidden:
• duplicate DTOs
• UI shadow models
• hand-copied interfaces

CI blocks divergence.

⸻

⸻

7. Repo Topology Doctrine

Three tiers:

⸻

Tier 1 — Pure Monorepo

Unified workspace. Shared contracts.

⸻

Tier 2 — Hybrid + Submodules

Root repo is command center.

Submodules allowed for:

• licensing
• regulatory boundaries
• vendor forks
• independent lifecycles

Rules:

• declared in /SOT.md
• local AGENT.md required
• contracts cannot diverge

⸻

Tier 3 — Multi-Repo

Only allowed with:

• MCP context packs
• orchestrator injection
• per-repo CODEBASE maps

⸻

⸻

8. agent-scripts Ops Kit Pattern

Adopt:

• pointer AGENT files
• central ops-kit repo
• docs indexing
• commit helpers
• browser automation
• submodule beacons

A2rchitech mirrors this as:

Law + Tooling Pack Submodule

⸻

⸻

9. Miessler PAI → Agent Order-of-Operations

⸻

Outer Loop

observe → think → plan → build → execute → verify → learn


⸻

Determinism Ladder

goal → code → cli → prompts → agents

Agents must justify dropping to higher entropy layers.

Enforced by orchestrator + CI.

⸻

⸻

10. Enforcement Surfaces

⸻

CI / Pre-Commit

• WIH required
• CODEBASE refs required
• forbidden path edits blocked
• contract changes gated
• delta discipline enforced
• submodule violations blocked
• determinism violations flagged

⸻

⸻

Orchestrator

• loads law bundle
• injects context pack
• enforces tool gates
• blocks path violations
• logs violations
• requires acceptance refs

⸻

⸻

11. Law Beacons

Root:

• /agent/AGENT.md
• /agent/POLICY.md
• /agent/OPERATIONS.md

Roles:

• Architect
• Planner
• Implementer
• Tester
• Reviewer
• Security

Runbooks:

• monorepo-changes
• migrations
• release

Subtrees:

• AGENT.md
• CONTRACTS.md
• BOUNDARIES.md

⸻

⸻

12. A2rchitech Default User Project Bootstrap

When a user creates a project in A2rchitech:

They automatically receive:

• Repo Law vNext scaffold
• WIH schema enforcement
• CODEBASE generator
• Protocol registry
• Contract templates
• Submodule wiring
• CI gates
• Orchestrator rules
• Ops kit mirror
• Doc indexing
• Determinism ladder

This is productized architecture — not documentation.

⸻

⸻

SESSION STATUS

✅ Saved as canonical A2rchitech design session
🟡 Framework remains under development
📌 This defines how A2rchitech boots user projects by default

⸻

