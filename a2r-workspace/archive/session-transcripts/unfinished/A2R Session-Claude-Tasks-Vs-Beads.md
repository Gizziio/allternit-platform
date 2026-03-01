Here is the A2rchitech Session Markdown Summary for this thread, focused on:

Claude Code Tasks vs Beads — Agent Coordination & Memory Systems

⸻

A2R Session — Claude Tasks vs Beads

Topic: Agent Coordination Layers & Persistent Task Graphs
Date: 2026-01-26
Project: A2rchitech OS
Status: Saved for canonical buildout thread

⸻

1. Problem Being Examined

You requested research and architectural comparison between:
	•	Claude Code’s new “Tasks” feature
	•	The Beads project (git-native agent memory / task graph system)

Goal:

Determine whether Claude Tasks meaningfully replace Beads, whether they complement it, and what this implies for A2rchitech’s orchestration and persistence layer at scale—especially under agent swarm conditions.

⸻

⸻

2. Claude Code Tasks — Technical Characterization

Core Function

Claude Tasks is a native coordination primitive inside Claude Code.

It replaces simple todos with:
	•	Structured task lists
	•	Dependency graphs
	•	Blocking relationships
	•	Persistent task IDs
	•	Optional cross-session survival

Observed Capabilities
	•	Tasks can depend on other tasks
	•	Can persist across restarts via CLAUDE_CODE_TASK_LIST_ID
	•	Supports long-running coding workflows
	•	Integrated directly into Claude Code UI + runtime
	•	Optimized for within-tool planning & execution

Design Intent
	•	Lightweight coordination layer
	•	No external DB
	•	No repo-native persistence
	•	No cross-tool memory
	•	No Git branching semantics

Architectural Role

Claude Tasks acts as:

An in-runtime DAG scheduler for work units inside a single agent environment.

⸻

⸻

3. Beads Project — Technical Characterization

Core Function

Beads is:
	•	A git-tracked task graph
	•	Stored in .beads/
	•	Versioned with code
	•	Agent-agnostic
	•	Durable across sessions, branches, and models

Capabilities
	•	JSONL task nodes
	•	Dependency edges
	•	Blocking relations
	•	History
	•	Branching
	•	Merge conflicts resolved like code
	•	External memory store for agents

Architectural Role

Beads is:

A repo-native persistent cognition layer for agents.

It acts as:
	•	Long-horizon planning DB
	•	Multi-agent coordination substrate
	•	Externalized agent memory
	•	Replayable reasoning substrate

⸻

⸻

4. Direct Comparison Matrix

Axis	Claude Tasks	Beads
Location	Inside Claude Code	Repo-native
Persistence	Optional	Default
Branch-aware	No	Yes
Git-versioned	No	Yes
Tool-agnostic	No	Yes
Long-term memory	Limited	Yes
DAG dependencies	Yes	Yes
Multi-agent coordination	Partial	Strong
Distributed workflows	Weak	Native
Install effort	None	Required


⸻

⸻

5. Key Architectural Insight for A2rchitech

Claude Tasks and Beads are not equivalent systems.

They operate at different layers:

┌─────────────────────────────┐
│ Claude Code Runtime         │
│  └── Tasks (local DAG)      │
├─────────────────────────────┤
│ A2rchitech Orchestrator     │
│  └── Work Graph Engine      │
├─────────────────────────────┤
│ Repo-Native Memory Layer    │
│  └── Beads-like System      │
└─────────────────────────────┘

Interpretation:

Claude Tasks is:
	•	A runtime scheduler

Beads is:
	•	A stateful cognition substrate

For A2rchitech:

You want BOTH layers abstracted.

⸻

⸻

6. Strategic Direction for A2rchitech

Recommendation:

A2rchitech should implement:

Layer 1 — Runtime Task Graphs

Claude-like:
	•	Ephemeral DAGs
	•	Fast scheduling
	•	Per-session execution
	•	In-memory
	•	Tool-specific

Layer 2 — Repo-Native Durable Memory

Beads-like:
	•	Git-tracked
	•	Branch-aware
	•	Agent-agnostic
	•	External truth store
	•	Long-horizon cognition

⸻

⸻

7. Implications for Agent Swarms

In swarm scenarios:
	•	Claude Tasks ≈ local worker queue
	•	Beads ≈ global project ledger

For A2rchitech:

The orchestrator should compile Beads-style task graphs into runtime DAGs inside worker agents.

⸻

⸻

8. A2rchitech Actionable Design Hooks

Add to Architecture:

✅ Work Graph Compiler
	•	Reads repo memory graph
	•	Emits runtime DAG
	•	Assigns to agents

✅ Durable Memory Store
	•	Git-native
	•	JSON schemas
	•	Conflict resolution rules

✅ Orchestrator Arbitration
	•	Prevents two agents editing same file
	•	Assigns shards of work graph

✅ Tool-Native Task Adapters
	•	Claude Tasks adapter
	•	Cursor adapter
	•	OpenAI task adapter (future)
	•	CLI schedulers

⸻

⸻

9. Canonical Terminology Added

For A2rchitech:
	•	Persistent Work Graph (PWG) — Beads-like layer
	•	Runtime Task DAG (RTD) — Claude-like layer
	•	Work Compiler — translates PWG → RTD
	•	Swarm Arbiter — conflict resolver
	•	Cognition Store — durable agent memory

⸻

⸻

10. Why This Matters

This confirms a major A2rchitech thesis:

Agent platforms need two coordination systems:
	1.	Fast local schedulers
	2.	Durable distributed cognition

Claude Tasks solves (1).

Beads solves (2).

A2rchitech must unify both.

⸻

⸻

11. Tagged for Canonical A2rchitech Thread

This session is now categorized under:
	•	coordination-layer
	•	task-graphs
	•	agent-swarms
	•	repo-native-memory
	•	claude-tasks
	•	beads
	•	a2rchitech-core

