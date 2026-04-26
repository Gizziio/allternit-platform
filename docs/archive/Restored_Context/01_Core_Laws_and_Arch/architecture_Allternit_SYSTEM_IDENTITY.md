This is written as an authoritative system charter, not marketing copy.

⸻

A://rchitech — Agentic Engineering Operating System

1. What Is A://rchitech?

A://rchitech is a protocol-shaped operating system for autonomous and human-directed agents.

It is not:
	•	a chatbot
	•	a SaaS app
	•	an IDE
	•	a UI framework
	•	a workflow builder

It is:

a layered execution substrate, governance engine, orchestration fabric, and UI embodiment platform for agentic systems.

A://rchitech provides:
	•	deterministic execution harnesses
	•	runtime sandboxes
	•	policy enforcement
	•	multi-agent DAG orchestration
	•	memory systems
	•	tool adapters
	•	embodied workspaces
	•	OS-level command surfaces
	    execution kernels
	    scheduling
		auditing & replay
 		embodiment surfaces
 		UI shells
		adapters to external systems

All components mount beneath a single namespace root.

⸻

2. System Grammar

A://rchitech uses OS-style protocol grammar:

A://{layer}/{component}

Examples:

A://kernel/engine
A://runtime/browser
A://agent/router
A://studio/cowork
A://memory/journal

CLI form:

a://kernel
a://agent
a://studio

This grammar is:
	•	filesystem-like
	•	URI-shaped
	•	RPC-ready
	•	service-addressable
	•	composable across environments

It defines how everything in the system is mounted.

⸻

## Core Design Principles

### Model-Agnostic Execution

No agent is tied to a specific model provider.

Claude, Codex, Gemini, open-source models, subprocess CLIs, browsers, and sandboxes are all mounted into the same harness interface and governed by the same execution rules.

---

### Deterministic Agent Engineering

All agent execution is:

- ticketed via Work-In-Hand (WIH)
- policy-checked
- receipt-logged
- replayable
- sandboxed
- auditable

The system is designed for **engineering discipline**, not prompt hacking.


3. The Harness Concept

In A://rchitech, a Harness is:

a deterministic execution envelope that mounts models, tools, runtimes, policies, and UI surfaces into a controlled agent environment.

A harness is not a model.

It is the system that:
	•	invokes models
	•	enforces permissions
	•	controls tool access
	•	captures traces
	•	persists history
	•	replays runs
	•	routes DAGs
	•	binds UI surfaces
	•	isolates sandboxes

Claude Code, Codex, Devin, and similar tools are examples of harnesses.

A://rchitech provides a general-purpose, vendor-agnostic harness capable of mounting:
	•	local LLMs
	•	API models
	•	CLI tools
	•	browsers
	•	desktop automation
	•	VM environments
	•	schedulers
	•	cron agents
	•	persistent background workers

⸻

4. Layered Architecture

A://rchitech is structured as a vertical OS stack.

Top-level layers:

infrastructure/
domains/kernel/
domains/governance/
services/
services/
5-ui/
6-apps/

Each layer has:

- strict import rules
- defined responsibilities
- upward-only dependencies
- no cross-layer leakage


0-Substrate — Foundations

Shared primitives:
	•	schemas
	•	protocols
	•	type systems
	•	UI grammars
	•	DAG formats
	•	memory contracts
	•	agent envelopes

⸻

1-Kernel — Execution Engine

Low-level runtime:
	•	process execution
	•	sandboxing
	•	VM control
	•	filesystem access
	•	network IO
	•	tool invocation
	•	resource isolation
	•	scheduling primitives

This is the physical engine of the OS.

⸻

2-Governance — Policy Layer

Controls:
	•	Work-In-Hand (WIH)
	•	permissions
	•	receipts
	•	audit trails
	•	approvals
	•	security gates
	•	access scopes

Governance is not optional.
Every execution request flows through governance.

⸻

3-Adapters — Runtime Bridges

Mount external systems:
	•	browsers
	•	MCP servers
	•	LLM providers
	•	CLI runners
	•	WebVM
	•	containers
	•	desktop automation
	•	cloud executors

Vendor code is quarantined here.

⸻

4-Services — Long-Running Agents

Persistent processes:
	•	schedulers
	•	routers
	•	memory daemons
	•	observation systems
	•	gateways
	•	voice stacks
	•	UI backends
	•	orchestration coordinators

⸻

5-UI — Embodiment Layer

Reusable UI substrate:
	•	Cowork workspace
	•	Code mode (ADE)
	•	panel systems
	•	rail systems
	•	canvas renderers
	•	inspectors
	•	visual DAGs
	•	console drawer
	•	voice presence
	•	UI-TARS-derived automation surfaces

⸻

6-Apps — Entry Surfaces

End-user applications:
	•	shell-ui
	•	shell-electron
	•	CLI
	•	API gateway
	•	studio shells
	•	openwork-style environments
	•	mobile shells

⸻

5. Cowork, Code, and Studio Surfaces

A://rchitech exposes multiple embodiment modes:

Cowork Mode

Document-centric workspace:
	•	plugins
	•	MCP connectors
	•	skills
	•	commands
	•	multi-panel canvases
	•	project memory
	•	execution traces
	•	DAG inspectors

⸻

Code Mode (ADE)

Agent Development Environment:
	•	terminal orchestration
	•	diff views
	•	multi-agent runs
	•	Kanban DAG boards
	•	live logs
	•	execution inspectors
	•	runtime shells
	•	replay timelines

⸻

Studio

Visual control plane:
	•	agent swarms
	•	scheduling
	•	background jobs
	•	memory graphs
	•	provider routing
	•	security scopes

⸻

6. Rebranding and First-Party Products

Third-party projects integrated into A://rchitech are:
	•	re-branded
	•	quarantined as vendors
	•	surfaced only through first-party harness layers

Legacy runtime becomes:

services/allternit-runtime

UI-TARS becomes:

5-ui/automation

No vendor names appear at public surfaces.
## Relationship to External Projects

Forked or upstream systems (UI-TARS, OpenWork, WebVM, etc.) are:

- quarantined
- rebranded
- feature-cherry-picked
- never exposed directly

A://rchitech does not become a wrapper around them.

They become **providers inside the OS**.


⸻

7. OS-Level Namespace Commands

Certain surfaces are reserved as system primitives:

A://kernel
A://agent
A://runtime
A://studio
A://browser
A://capsule
A://skill
A://pipeline
A://memory
A://graph
A://vm
A://network
A://security
A://orchestrator

These map to:
	•	CLI roots
	•	config namespaces
	•	runtime mounts
	•	UI routes
	•	RPC entrypoints

⸻

8. System Positioning

A://rchitech is positioned as:

an agentic engineering operating system — not an application.

It competes structurally with:
	•	operating systems
	•	runtime environments
	•	orchestration fabrics
	•	automation kernels
	•	AI infrastructure stacks

Not chat products.

⸻

9. Canonical Lock

The following are frozen:
	•	Sigil: A://
	•	System Name: A://rchitech
	•	CLI Root: a://
	•	Grammar: A://{layer}/{component}
	•	Structure: layered OS
	•	Vendor quarantine mandatory
	•	Harness-first architecture

No alternate spellings.

No product-style dilution.

No SaaS framing.

## What This Repo Represents

This repository is the **single source of truth** for:

- the Agentic OS kernel
- runtime harness
- governance systems
- orchestration engines
- memory infrastructure
- UI shells
- execution adapters
- application entrypoints

No new subsystem may be introduced without:

- a layer assignment
- import rules
- spec contract
- audit surface
- rollback plan

---

## Long-Term Goal

A://rchitech is designed to become:

- the substrate for agent engineering
- the Linux of agent runtimes
- the Kubernetes of autonomous workflows
- the OS that tools, models, and robots plug into

All future systems (Ëtrid agents, Terra Source automation, trading agents, robotics stacks, research swarms) are intended to run **on top of this OS**, not beside it.

---

## Non-Negotiables

- No direct UI → kernel calls
- No vendor imports across layers
- No tool execution without WIH
- No agents without receipts
- No silent side effects
- No ad-hoc execution paths
- No orphan services

Everything flows through the harness.

Everything is governed.

Everything is replayable.


