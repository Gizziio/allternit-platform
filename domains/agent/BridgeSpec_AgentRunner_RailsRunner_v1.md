# Bridge Spec: Agent Runner ↔ Rails Runner (Allternit)

<SECTION id="meta">
---
bridge_spec_version: 1
status: draft_locked_for_iteration
principle: "Rails owns truth; Agent Runner owns LLM execution."
rails_repo_observed: "allternit-agent-system-rails.zip"
---
</SECTION>

<SECTION id="1_separation">
## 1) Separation of concerns (non-negotiable)

### Rails (control / truth plane)
Rails already defines:
- DAG/WIH work surface
- Mail/logistics
- Append-only ledger event envelope + taxonomy
- Leases
- Receipts store
- Vault pipeline (closure bundling)

(These are visible in the Rails spec docs and CLI contract.)

### Agent Runner (execution plane)
Agent Runner does:
- context pack assembly + policy injection
- agent/team orchestration + bounded loops
- hook runtime around tool calls
- policy enforcement at execution boundary
- emits evidence via Rails only

Agent Runner MUST NOT:
- author ledger truth
- mint leases/receipts as authority
- write durable state outside Rails
</SECTION>

<SECTION id="2_contracts">
## 2) Integration contract: only three primitives

Agent Runner integrates with Rails via **three** primitives:

### A) Read projections / event stream
- fetch current DAG/WIH state (projection)
- subscribe/poll for actionable items (e.g., “needs work”, “blocked”, “needs review”)

### B) Claim work via leases
- Agent Runner requests lease for a specific node/WIH/run scope
- Rails grants/denies; lease heartbeat/renewal is required

### C) Submit evidence and request state transitions
- Agent Runner submits receipts/evidence blobs (or references)
- Agent Runner requests WIH close / node status transitions
- Rails gate validates invariants and writes ledger events

Everything else is sugar around these.

</SECTION>

<SECTION id="3_event_bridge">
## 3) Event/API surface (minimal)

### 3.1 Rails → Runner (signals)
Runner needs a stable way to discover *what to execute*.
Use projections + a single “work queue” view derived from ledger:
- candidates: nodes whose deps satisfied and status == READY (or equivalent)
- include: dag_id, node_id, wih_id, required_roles, execution_mode, acceptance refs, required evidence refs

### 3.2 Runner → Rails (commands)
Runner performs only these stateful commands (via CLI or HTTP):
1) `LeaseRequested` (claim)
2) `RunStarted` (bind run_id, role, context_pack_id)
3) `ReceiptWritten` (tool events, artifacts, test outputs, decisions)
4) `RunEnded` (success/failure)
5) `WIHCloseRequested` (when validator PASS is produced)
6) `DagNodeStatusChanged` (BLOCKED / NEEDS_INPUT / etc.), only if gate allows

Rails already has event groups for runs/receipts/leases/WIH lifecycle. Runner should reuse them rather than invent a parallel ledger.  

</SECTION>

<SECTION id="4_context_packs">
## 4) ContextPack handshake (where your prompt packs plug in)

Runner builds ContextPacks, but Rails is the authority for what is “in scope”.

Rule:
- Runner may build a derived ContextPack artifact, but it must be referenced in Rails as evidence (ReceiptWritten) and never treated as truth.

ContextPack MUST include:
- AGENTS.md + .allternit/agents/* policy bundle hash
- DAG slice (node + hard deps + minimal receipts from deps)
- WIH file (or WIH projection)
- current lease info (scope + expiry)
- plan-with-files artifacts (if used)

Runner MUST emit an injection marker per context:
- agents_md_hash
- policy_bundle_id
- context_pack_id
- run_id / iteration_id

</SECTION>

<SECTION id="5_tool_boundary">
## 5) Tool execution boundary (no drift)

This is the critical bridge:

- Runner executes tools (filesystem, bash, web, etc.)
- But **every** tool execution must be:
  1) validated against ToolRegistry schema
  2) permitted by WIH allowed_tools + writes policy
  3) permitted by PolicyEngine + PermissionRequest stage when needed
  4) logged as receipts/events and sent to Rails

Rails remains the canonical store of “what happened” via ReceiptWritten + ledger events.

</SECTION>

<SECTION id="6_idempotency">
## 6) Idempotency and concurrency

Rails already relies on leases and an append-only ledger.
Runner must additionally guarantee:
- claim-once semantics per (dag_id,node_id,role) at a time
- safe replay after crash:
  - if lease expired, re-claim
  - if RunStarted exists without RunEnded, emit RunEnded(BLOCKED) with reason and escalate

</SECTION>

<SECTION id="7_cli_binding">
## 7) Binding to Rails CLI today (no new API required)

Rails already specifies semantic CLI contracts (commands → gate checks → events).

Bridge approach:
- Agent Runner calls Rails CLI as its control interface.
- Later, mirror the same semantics in an HTTP API without changing the contract.

This keeps Rails small and avoids “Runner logic” leaking into Rails.

</SECTION>
