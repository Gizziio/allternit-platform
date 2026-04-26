Below is a paste-ready Markdown file you can drop directly into your repo as:

/research/craft-agents-oss-analysis.md


⸻

Craft Agents OSS → Allternit Integration Analysis

Repository:
https://github.com/lukilabs/craft-agents-oss

⸻

1. Session Overview

This session analyzed the Craft Agents OSS project to determine:
	•	What it actually is (architecture + UX model)
	•	What components are reusable for Allternit
	•	What should not be copied
	•	How to technically absorb it into the Allternit repo
	•	Strategic alignment with Allternit long-term architecture

The conclusion:

Craft Agents OSS is not an agent runtime brain.
It is a polished agent-native desktop operator interface with strong UX primitives that can accelerate Allternit’s shell layer.

It should be treated as:
	•	A UX reference implementation
	•	A structural pattern library
	•	A desktop shell blueprint

Not:
	•	A drop-in runtime
	•	A model router
	•	A state-machine brain replacement

⸻

2. What Craft Agents OSS Actually Is

High-level architecture:
	•	Electron desktop app
	•	React (Vite) frontend
	•	shadcn UI components
	•	Local workspace persistence (~/.craft-agent/)
	•	AES-256-GCM encrypted credential storage
	•	“Sources” abstraction layer (MCP, REST, filesystem)
	•	“Skills” per workspace
	•	Permission mode system (read-only, ask-to-edit, allow-all)
	•	Session workflow states
	•	Multi-file diff viewer
	•	Background agent execution support

Core idea:

Turn chat-based agents into workspace-aware operator tools.

⸻

3. High-Value Components to Map into Allternit

3.1 Sources + Skills Model

Craft Pattern:
	•	Sources = connectors (MCP servers, REST APIs, local FS)
	•	Skills = stored instructions per workspace invoked inline

Allternit Mapping:
	•	Sources → Capsules + Tool Registry
	•	Skills → Marketplace Skills Layer (extensible, versioned)
	•	MCP connectors → Allternit Tool Contracts
	•	Workspace-level config → Capsule-scoped state

Strategic Fit:
Perfect alignment with Allternit’s Tool Plane + Contract-first design.

⸻

3.2 Permission Modes

Craft Pattern:
	•	Read-only
	•	Ask before edits
	•	Allow all

Switchable during session.

Allternit Mapping:
	•	Permission mode becomes a UI abstraction for:
	•	POLICY.md gating
	•	Tool safety tiers
	•	Destructive tool constraints
	•	Reviewer enforcement

This gives Allternit a user-comprehensible control layer for your law system.

⸻

3.3 Workflow States

Craft Pattern:
	•	Todo
	•	In Progress
	•	Needs Review
	•	Done

Allternit Mapping:
	•	WIH state
	•	Beads progress
	•	DAG task status
	•	Acceptance test gating

Craft gives you a lightweight UI prototype of what becomes a deterministic work graph in Allternit.

⸻

3.4 Multi-File Diff Viewer

Craft Pattern:
	•	VS Code-style diff for agent edits

Allternit Mapping:
	•	Reviewer Agent UI
	•	Merge gate visualization
	•	Contract validation surface

This should absolutely exist in Allternit Shell.

⸻

3.5 Local Persistence + Encrypted Secrets

Craft Pattern:
	•	Session logs saved locally
	•	Encrypted credential store
	•	Structured config directory

Allternit Mapping:
	•	Capsule-local storage
	•	.allternit state folders
	•	Deterministic secret vault
	•	Offline-first agent runtime

This directly supports your “living files” and local-first thesis.

⸻

4. What NOT to Absorb

4.1 Claude-Specific Runtime Coupling

Craft leans heavily on Claude Agent SDK.

Allternit Goal:
	•	Multi-LLM routing
	•	Runtime brain decoupled from vendor
	•	Role-based orchestration

Do NOT inherit:
	•	Vendor-locked runtime abstractions
	•	Hard-coded model workflows

Keep runtime independent.

⸻

4.2 Do Not Replace Your Brain Runtime

Craft is a UI shell + integration harness.

You still need:
	•	State machine
	•	Tool arbitration loop
	•	Retry logic
	•	Streaming backpressure
	•	Multi-session supervision

That is Allternit’s execution layer, not Craft’s.

⸻

5. Integration Strategy for Allternit

Three viable paths:

⸻

Option A — Reference-Only (Recommended)

Use Craft as:
	•	UX pattern reference
	•	Structural blueprint
	•	Interaction inspiration

Rebuild:
	•	Workspaces
	•	Sources panel
	•	Skills panel
	•	Permission toggle
	•	Diff viewer

Inside Allternit’s Electron shell using:
	•	Your capsule window system
	•	Your runtime brain
	•	Your contract engine

Lowest technical debt.

⸻

Option B — Partial Fork (Medium Risk)

Fork Craft.
Remove:
	•	Claude SDK dependency
Replace:
	•	Agent runtime wiring
Plug in:
	•	Allternit router
	•	Tool registry
	•	WIH state machine

This accelerates UI delivery but requires heavy refactoring.

⸻

Option C — Cherry-Pick Packages

Lift:
	•	Encryption utilities
	•	Persistence patterns
	•	Source abstraction ideas

Integrate into:
	•	/packages/allternit-shell
	•	/packages/allternit-storage
	•	/packages/allternit-secrets

Most surgical, least risky.

⸻

6. How To Download and Absorb Into Allternit

Step 1 — Clone Repository

git clone https://github.com/lukilabs/craft-agents-oss.git
cd craft-agents-oss

Install dependencies:

pnpm install

Run dev environment:

pnpm dev


⸻

Step 2 — Create Allternit Research Branch

Inside your Allternit monorepo:

git checkout -b research/craft-absorption

Add Craft as a reference module:

mkdir research/vendor
mv craft-agents-oss research/vendor/

OR add as git subtree:

git subtree add --prefix=research/vendor/craft-agents https://github.com/lukilabs/craft-agents-oss.git main --squash


⸻

Step 3 — Audit Structure

Map directories to Allternit architecture:

Craft Component	Allternit Equivalent
Workspaces	Capsules
Sources	Tool Registry
Skills	Marketplace Skills
Permission Modes	POLICY Gates
Session States	WIH Status
Diff Viewer	Reviewer Capsule
Persistence	.allternit Storage


⸻

Step 4 — Extract UI Primitives

Rebuild inside Allternit Shell:
	•	Sidebar: Workspace / Capsule Switcher
	•	Sources Panel
	•	Skills Panel
	•	Permission Toggle
	•	Diff Modal
	•	Session State Badges

Do NOT import runtime layer directly.

⸻

7. Strategic Fit With Allternit Vision

Craft proves:
	•	Agent-native desktop UX works
	•	Workspace-scoped agents are intuitive
	•	Permission modes increase trust
	•	Background tasks must be visible
	•	Diff review is mandatory

Allternit extends this by adding:
	•	Deterministic state machine runtime
	•	Role-based agent orchestration
	•	Multi-LLM routing
	•	Contract-first execution
	•	WIH + Beads deterministic tracking
	•	Law layer enforcement
	•	Capsule window system
	•	Swarm orchestration
	•	Marketplace extensibility

Craft = Operator UX
Allternit = Operator UX + Runtime Brain + Swarm Engine + Law System

⸻

8. Final Architectural Position

Craft Agents OSS should be treated as:

A high-quality operator desktop blueprint that validates your direction.

Do not adopt the runtime.

Do absorb:
	•	UX structure
	•	Permission abstraction
	•	Sources/Skills mental model
	•	Diff review UX
	•	Persistence patterns

Rebuild those inside Allternit using:
	•	Your state machine
	•	Your routing engine
	•	Your tool contracts
	•	Your WIH schema
	•	Your law layer

⸻

9. Recommended Immediate Action Plan
	1.	Clone Craft locally.
	2.	Run it and test UX flows.
	3.	Document interaction patterns.
	4.	Rebuild the sidebar + diff viewer in Allternit shell.
	5.	Design Allternit-native “Sources” panel tied to tool contracts.
	6.	Implement permission mode toggle tied to POLICY.md.
	7.	Integrate workflow states into WIH tracking.

⸻

10. Summary

Craft Agents OSS accelerates Allternit at the interface layer, not the execution layer.

It validates:
	•	Workspace-scoped agents
	•	Visual tool orchestration
	•	Permission gating UX
	•	Session lifecycle visualization
	•	Background execution transparency

It should inform your Shell.

It should not replace your Brain.
