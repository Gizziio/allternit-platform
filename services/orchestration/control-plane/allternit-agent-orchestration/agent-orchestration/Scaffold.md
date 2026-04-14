# /spec/layers/agent-orchestration/Scaffold.md
# Agent Orchestration Layer — Placement, Boundaries, and Module Contracts

**Status:** Scaffold (derived mapping)  
**Source preserved verbatim:** `/spec/layers/agent-orchestration/Original_AgentOrchestration.md`

## 1) Where this layer resides
This content is the **L3 Agent Orchestration + L4 Skill System + L2 Governance** bundle, expressed in Unix-first microservices form:
- Workflow Engine (scientific loop) → L3
- Agent System (roles) → L3
- Context Router → L5 (memory hydration/routing, invoked by L3)
- History Ledger (UOCS) → L1/L5 (audit + episodic memory)
- Hook Bus (lifecycle middleware) → L1/L3
- Tool Gateway (policy-gated side-effects) → L1/L4
- Skill Registry (signed packages) → L4 (registry) + L2 (publisher identity)

This is explicitly reflected by the docker-compose service split:
`workflow-engine`, `skill-registry`, `context-router`, `history-ledger`, `hook-bus`, `tool-gateway`, plus `redis` + `db`. 

## 2) Unix-like modularity rule
Each module must be:
- single-purpose,
- contract-first (typed I/O),
- replaceable without refactoring the rest,
- composable via workflow DAGs.

## 3) Contracts between modules (minimal)
### 3.1 Messaging contracts
- TaskQueue: enqueue/dequeue with task envelope
- EventBus: pub/sub for lifecycle + observability
- Protocols: shared schemas for tasks/events/artifacts

### 3.2 Policy contracts
Every side-effect path must call Policy Gateway before execution:
- PreToolUse hook triggers policy decision
- Policy returns allow/deny + constraints (scope, budget, tier, environment)

### 3.3 History contracts (UOCS)
Every module emits append-only events to History Ledger:
- markdown (human narrative)
- jsonl (machine replay)

## 4) What still needs dedicated layer specs
The original doc contains full subsystem definitions that deserve their own layer specs (scaffolds created):
- `/spec/layers/messaging/`
- `/spec/layers/workflows/`
- `/spec/layers/skills/`
- `/spec/layers/context-routing/`
- `/spec/layers/history/`
- `/spec/layers/hooks/`
- `/spec/layers/tool-gateway/`
- `/spec/layers/security-governance/`

These hold **implementation-ready** contracts and folder-level responsibilities.
