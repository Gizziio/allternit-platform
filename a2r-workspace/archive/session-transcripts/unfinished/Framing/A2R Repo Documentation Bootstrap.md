---
title: "A2rchitech Session Summary — Architecture / Repo Law"
date: 2026-01-26
topic: architecture-repo-law
command: "gizzi save a2r session"
output: "repo documentation spec for CODEBASE.md bootstrap"
---

# Session Objective
Define a **best-practice repo documentation spec** that reliably produces a canonical `CODEBASE.md` (and optional index/graphs), optimized for agent onboarding, repo navigation, and “repo law” style determinism: evidence-backed claims, stable anchors, and operational usefulness.

# Core Deliverable Produced
A paste-ready **/bootstrap-repo-docs** command spec (opencode/claude-code style) that:
- Launches **10 parallel exploration agents**
- Enforces **evidence + confidence + unknowns** reporting
- Synthesizes results into a structured `CODEBASE.md`
- Optionally emits `CODEBASE.index.md`, `CODEBASE.graph.md`, `DOCS_INDEX.md`

# Repo Law / Architecture Principles Locked In
## 1) Evidence-Backed Truth
All repo-map statements must be grounded in:
- file paths (and ideally line ranges/snippets)
- manifests/configs as “primary sources”
No speculation; unknowns must be labeled with “next file to inspect”.

## 2) CODEBASE.md as Canonical Retrieval Anchor
`CODEBASE.md` is treated as the durable “entry map” for agents and humans:
- “Where is X implemented?”
- “How does X work end-to-end?”
- “How do I run/test/deploy?”
- “What breaks if I change Y?”

## 3) Parallelism with Context Isolation
Parallel subagents reduce context pollution and speed scanning. Each agent returns:
- structured output
- evidence list
- confidence rating
- gaps/unknowns

## 4) Operational Utility > Narrative
Documentation must include:
- minimal run recipe (2–5 commands)
- request lifecycle walkthrough
- interface inventory (API/CLI/UI)
- deployment/runbook/debug flow
- “how to change safely” section (coupling + boundaries)

# The 10-Agent Exploration Map (Final)
1. Repo structure & entrypoints  
2. Documentation inventory & gaps  
3. Config & build system  
4. Runtime/execution model (processes, ports, services)  
5. Data layer & state (schemas, migrations, caches)  
6. Interfaces (API/routes/UI/CLI) + inventory table  
7. Core domains & business logic (entities, invariants, workflows)  
8. Testing & quality gates  
9. Deployment/ops/observability + runbook outline  
10. Dependencies & risk surface (security-sensitive deps, update strategy)

# CODEBASE.md Required Structure (Final)
0) TL;DR  
1) System Overview  
2) Repository Map  
3) Getting Started  
4) Architecture (components + dependency graph + request lifecycle)  
5) Data Layer  
6) Interface Reference (API/CLI/UI inventories)  
7) Core Domain & Logic (glossary + invariants)  
8) Testing & Quality  
9) Deployment & Operations (debug playbook)  
10) Dependency Notes (security + upgrades)  
11) How to Change Safely (boundaries + checklist)  
12) Documentation Index (existing docs + staleness)

# Validation Gates (Anti-Fluff)
A valid CODEBASE must include:
- many evidence anchors (paths) appropriate to repo size
- ≥1 end-to-end request walkthrough
- ≥1 operational debug flow
- interface inventory table
- domain glossary
- explicit gaps + “next file to inspect”

# Optional Law Extensions (Recommended)
- `CODEBASE.graph.md`: text graphs (component, request flow, data write path, async jobs)
- `CHANGEPOINTS.md`: coupling map (“change X ⇒ update Y”)

# Intended Use in A2rchitech
This spec becomes part of the “repo law” layer by defining:
- deterministic doc generation behavior
- canonical retrieval anchor (`CODEBASE.md`)
- evidence discipline and confidence scoring
- operational + change-safety requirements that agents must satisfy

Below is a repo documentation spec you can paste into your agent system (opencode / claude-code style). It’s optimized to produce a single, durable CODEBASE.md that is: accurate, linkable, navigable, and useful for onboarding + agentic navigation.

It improves your 10-agent bootstrap by adding: evidence requirements, link-indexing, architecture diagrams as text, API inventory generation, critical path mapping, runbooks, and “how to change safely” guidance.

⸻

Best Repo Documentation Spec (CODEBASE.md)

Goals (non-negotiable)
	•	Produce one canonical repo map that an agent can use as a retrieval anchor.
	•	Every claim must be backed by file references (paths) or direct snippets.
	•	Make it easy to answer:
“Where is X implemented?”, “How does X work end-to-end?”, “How do I run/test/deploy?”, “What can break if I change Y?”

Output files
	•	CODEBASE.md (single main doc)
	•	CODEBASE.index.md (optional, if monorepo / very large)
	•	CODEBASE.graph.md (optional: dependency & flow graphs in text form)
	•	DOCS_INDEX.md (optional: all docs + quality assessment)

⸻

/bootstrap-repo-docs (command)

---
description: Explore repository with parallel agents and generate evidence-backed CODEBASE.md (best-practice spec)
agent: build
tools: [task, filesystem, ripgrep, tree, git]
---
# Bootstrap Repository Documentation (Best Spec)

## Target
$ARGUMENTS
If no target specified, analyze entire repository root.

## Global Rules (apply to all agents)
- Every finding MUST include:
  - `evidence:` list of file paths + (optional) line ranges
  - `confidence:` high|medium|low
  - `notes:` assumptions, unknowns, missing pieces
- Prefer primary sources:
  - entrypoints, package manifests, configs, CI files, dockerfiles, infra
- Avoid speculation. If unclear, mark as `unknown` and name the next file to inspect.
- Extract linkable anchors (paths, headings).
- Output must be structured Markdown sections.

## Step 1: Launch all agents in parallel (single message)

### Agent 1 — Repo Structure & Entry Points
@ explore Map the directory structure and identify entrypoints.
Deliver:
- repo type (monorepo/multi-service/monolith/library)
- top-level dirs with purpose
- primary runtime entrypoints + CLI entrypoints
- naming conventions
Include evidence paths and a short “mental model” paragraph.

### Agent 2 — Docs Inventory & Gaps
@ explore Find all documentation and evaluate quality.
Deliver:
- doc list with paths + what each doc covers
- missing docs (install/run/test/deploy/architecture)
- any stale docs (mismatch vs code)
Include evidence.

### Agent 3 — Config & Build System
@ explore Analyze configuration and build tooling.
Deliver:
- package manager + workspace layout
- build scripts + task runners
- env vars & configuration hierarchy
- lint/format/typecheck settings
Include evidence, and a minimal “how to build” recipe.

### Agent 4 — Runtime & Execution Model
@ explore Identify how the system actually runs.
Deliver:
- processes/services started locally
- ports, protocols, service dependencies
- background workers/queues/schedulers
- feature flags and runtime toggles
Include evidence and a sequence view (text).

### Agent 5 — Data Layer & State
@ explore Map persistence and state handling.
Deliver:
- db types, schemas/models, migrations
- caching layers
- storage (filesystem/object store)
- read/write paths and data lifecycle
Include evidence and a “data flow” summary.

### Agent 6 — Interfaces (API/Routes/UI/CLI)
@ explore Inventory all interfaces.
Deliver:
- HTTP routes/endpoints or RPC methods
- auth boundaries
- public vs internal APIs
- CLI commands and flags
- UI entrypoints (if any)
Include evidence and a concise API inventory table.

### Agent 7 — Core Domains & Business Logic
@ explore Identify the domain model and core logic.
Deliver:
- domain entities and relationships
- critical business rules
- state transitions / workflows
- invariants (what must always be true)
Include evidence and a glossary.

### Agent 8 — Testing & Quality Gates
@ explore Map testing strategy and quality checks.
Deliver:
- test types (unit/integration/e2e)
- frameworks, locations, conventions
- how to run tests + common pitfalls
- coverage expectations and gates
Include evidence and commands.

### Agent 9 — Deployment / Ops / Observability
@ explore Analyze deploy and operational patterns.
Deliver:
- CI pipelines, deployment targets
- docker/k8s/infra-as-code
- logging/metrics/tracing
- secrets management and env strategy
Include evidence and a runbook outline.

### Agent 10 — Dependencies & Risk Surface
@ explore Analyze dependencies and risk.
Deliver:
- key runtime deps (what/why)
- build/dev deps
- security-sensitive deps (auth/crypto/parsing/eval)
- update strategy and lockfile behavior
Include evidence and “risk notes”.

## Step 2: Synthesize to CODEBASE.md (single source of truth)

Create CODEBASE.md with this exact structure:

# Codebase Documentation
> Auto-generated. Every claim should include evidence paths.

## 0) TL;DR
- What this repo is
- What it does
- How to run it (2–5 commands)
- Where to start reading code (3–7 links/paths)

## 1) System Overview
- Problem statement (inferred from code/docs; cite)
- User-visible surfaces (API/UI/CLI)
- High-level architecture (text diagram)

## 2) Repository Map
- Tree (top 2–3 levels)
- Key directories with purpose
- Entry points (runtime + CLI)
- Conventions (naming, layering)

## 3) Getting Started
- Prereqs
- Install
- Configure (.env, config files, secrets)
- Run locally
- Common issues (with fixes)

## 4) Architecture
- Components/services list
- Dependencies between components
- Request lifecycle (end-to-end walkthrough)
- Background jobs / async flows

## 5) Data Layer
- Datastores (tables/models) + migrations
- Caching strategy
- Data flow: create/read/update/delete path summaries

## 6) Interface Reference
### APIs
- Endpoint inventory (method/path → handler)
- Auth model
- Error model
### CLI
- Command inventory (command → file)
### UI (if applicable)
- Routes/pages → key components

## 7) Core Domain & Logic
- Domain entities + glossary
- Business rules and invariants
- Critical workflows (step-by-step)

## 8) Testing & Quality
- Test layout
- How to run (unit/integration/e2e)
- CI quality gates and checks

## 9) Deployment & Operations
- CI/CD summary
- Environments
- Deploy steps (if present)
- Observability (logs/metrics/traces)
- Oncall runbook basics (how to debug)

## 10) Dependency Notes
- Key dependencies (why they matter)
- Security notes
- Upgrade strategy

## 11) “How to Change Safely”
- Where to add new features
- Where NOT to touch first
- Expected refactor boundaries
- Checklist for PRs

## 12) Documentation Index
- Links to existing docs with notes on quality/staleness

## Step 3: Validation
- Ensure CODEBASE.md contains:
  - At least 20+ evidence links/paths in medium repos
  - At least 1 end-to-end request walkthrough
  - At least 1 operational debug flow
  - An interface inventory table
  - A domain glossary
- If gaps exist, list them explicitly with “next file to inspect”.

## Usage
/bootstrap-repo-docs
/bootstrap-repo-docs src/


⸻

Add-on: “Spec-first” enhancements (optional but strong)

If you want the best possible agent navigation, enforce these two extra outputs:
	1.	CODEBASE.graph.md (text-only diagrams)

	•	Component graph (Mermaid-like text, but no requirement)
	•	Request flow graph
	•	Data write path graph
	•	Job/queue flow graph

	2.	CHANGEPOINTS.md

	•	“If you change X, expect to update Y”
	•	Enumerate coupling points (config schema, auth, shared types, DB migrations)
