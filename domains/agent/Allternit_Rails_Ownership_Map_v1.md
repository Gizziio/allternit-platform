# Allternit Agent Rails — Ownership Map (v1)

**Source:** extracted from `/mnt/data/allternit-agent-system-rails.zip` (spec + CLI docs)

## 0) What Rails *is*

Rails is the **control plane** and authoritative source of truth. It is responsible for:
- **Ledger truth** (append-only state + provenance)
- **Leases** (write authority / concurrency)
- **Gates** (policy + invariants + acceptance checks)
- **Receipts / Vault** (immutable evidence store + artifacts)
- **Idempotent pipelines** (replay-safe state transitions)
- **Mail** (bounded coordination channel)

Rails is **not** the LLM executor. Anything that looks like “run an agent loop”, “spawn subagents”, “compact context”, etc. belongs in the **Agent Runner execution plane**.

---

## 1) Rails-owned primitives (canonical)

### 1.1 Ledger
Rails declares the ledger as the **only authoritative truth** and requires provenance for mutations.

**Key ideas (from SPEC_OVERVIEW):**
- append-only ledger events
- explicit provenance identifiers
- no overwrite semantics; “compaction” is a *derived* view, not truth

---

### 1.2 Leases
Rails owns concurrency correctness by requiring a **lease** for writes and defining how leases are acquired/renewed/revoked.

---

### 1.3 Gates
Rails runs gates to block invalid transitions. Rails gates include:
- policy checks
- acceptance/validation checks
- invariants (scope/path/tool) checks
- idempotency checks

---

### 1.4 Receipts + Vault
Rails owns **evidence capture**:
- tool-call evidence
- run logs / stdout/stderr capture
- artifact snapshots
- cryptographic/structural hashes (where applicable)

The Agent Runner may produce artifacts, but the *final durable record* is stored as Rails receipts/vault objects.

---

### 1.5 Mail (bounded coordination)
Rails includes a “mail” concept to coordinate deterministic workflows. Mail is not “chat”; it is a bounded message channel with explicit scope.

---

## 2) Rails event taxonomy (what Runner must speak)

### 2.1 Event categories (from EVENT_TAXONOMY)
```
# Event Taxonomy (v1)

## Envelope
All events are appended to the Ledger as JSON objects with:
- event_id (sortable)
- ts (transaction time)
- actor (user|agent|gate)
- scope (project_id, dag_id, node_id, wih_id, run_id)
- type
- payload
- provenance (optional): prompt_id, delta_id, agent_decision_id, parent_event_id

## Core event groups

### Prompt provenance
- PromptCreated
- PromptDeltaAppended
- PromptLinkedToWork
- AgentDecisionRecorded

### DAG planning and mutation
- DagCreated
- DagNodeCreated
- DagNodeUpdated
- DagNodeStatusChanged
- DagEdgeAdded (blocked_by)
- DagRelationAdded (related_to)

### WIH lifecycle
- WIHCreated
- WIHPickedUp
- WIHOpenSigned
- WIHHeartbeat
- WIHCloseRequested
- WIHClosedSigned
- WIHArchived

### Runs and receipts
- RunStarted
- ReceiptWritten
- RunEnded

### Leases
- LeaseRequested
- LeaseGranted
- LeaseDenied
- LeaseRenewed
- LeaseReleased

### Mail logistics
- ThreadCreated
- MessageSent
- ReviewRequested
- ReviewDecision

### Vault + learning + memory
- VaultJobCreated
- VaultJobCompleted
- LearningRecorded
- MemoryCandidateExtracted
- MemoryCommitted
```

**Runner implication:** Agent Runner must emit only Rails-understood event shapes; any richer internal runner tracing should be stored in Runner’s own event log and optionally bridged into Rails as receipts/evidence links.

---

## 3) Gate rules (what Runner must not bypass)

```
# Gate Rules (Enforcement)

## Gate 0 — Plan creation
Trigger: `allternit plan new` or equivalent.
Checks:
- PromptCreated exists (raw intent immutable)
- Create DagCreated + root node
- Link prompt → dag
- blocked_by edges remain acyclic
- mutations must include provenance (prompt delta or agent decision)
- prompt deltas and agent decisions must list linked mutation IDs (strict-mode enforcement ensures bidirectional traceability)

Emits:
- PromptCreated
- PromptDeltaAppended (initial baseline)
- DagCreated
- DagNodeCreated (root + initial structure)
- PromptLinkedToWork

## Gate 1 — WIH pickup/open
Trigger: `allternit wih pickup <node>`
Checks:
- target node status is READY
- role matches owner_role (unless override policy)
- no active WIH already bound to node (exclusive pickup)
- emit WIHPickedUp then require WIHOpenSigned before any tool/action
- if execution_mode is fresh, write ContextPack for the WIH
- record context_pack_path on WIHCreated for discovery

Emits:
- WIHCreated (if absent)
- WIHPickedUp
- (requires) WIHOpenSigned

## Gate 2 — PreToolUse
Trigger: any tool/action execution request
Checks:
- WIHOpenSigned is true
- tool is allowed by WIH policy
- if tool can write: lease must cover path(s)
- if merge/release: review approved if required
On denial: return structured error with gate id + reason.

## Gate 3 — PostToolUse
Trigger: tool/action completion
Checks:
- ReceiptWritten appended with content-addressed refs
- update derived status/evidence flags

## Gate 4 — WIH close
Trigger: `allternit wih close`
Checks:
- required evidence satisfied
- leases released or compatible with close policy
- node transition legal (RUNNING → DONE/FAILED)
Emits:
- WIHCloseRequested
- WIHClosedSigned (gate attestation)
- DagNodeStatusChanged

## Gate 5 — Vault pipeline
Trigger: WIHClosedSigned
Checks:
- receipt bundle integrity
- snapshots captured
Emits:
- WIHArchived
- VaultJobCreated → VaultJobCompleted
```

**Runner implication:** every mutation or “write-like” action must be routed through Rails gate/lease APIs; Runner never “just writes and hopes”.

---

## 4) Storage layout (Rails)
```
# Storage Layout (Locked)

Authoritative truth (append-only):
- `.allternit/ledger/events/YYYY-MM-DD.jsonl`

Atomic correctness (transactional):
- `.allternit/leases/leases.db`

Immutable evidence blobs (generated IDs):
- `.allternit/receipts/<receipt_id>/receipt.json`
- `.allternit/blobs/<blob_id>`

Fast retrieval (derived, rebuildable):
- `.allternit/index/index.db` (SQLite FTS)

Mail threads (derived view):
- `.allternit/mail/threads/<thread_id>.jsonl` (projection from ledger events)

Context packs (derived view):
- `.allternit/work/dags/<dag_id>/wih/context/<wih_id>.context.json`

Notes:
- Ledger is the single source of truth for state transitions.
- Leases are authoritative for locks only.
- Receipts and blobs are immutable evidence referenced by events.
- Index and mail thread files are projections and can be rebuilt.
- Tests: `tests/invariants.rs::authoritative_stores_are_created` asserts that ledger JSONL files, `leases.db`, receipt directories, and CAS blobs exist once the stores are initialized.
```

---

## 5) Receipts & Vault pipeline (Rails)
### 5.1 Receipts
```
# Receipts (Evidence)

## Purpose
Receipts are immutable evidence artifacts referenced by ledger events.

## Hashing
Receipt and blob hashing are **not** enabled in the current setup.
Receipts and blob artifacts use generated IDs; hashing can be layered later
if needed.
```

### 5.2 Vault
```
# Vault Pipeline + Compaction

## Trigger
- Gate initiates VaultJob on WIHClosedSigned

## Execution model (v1)
- Vault is synchronous: VaultJobCreated is emitted, archive runs inline, then VaultJobCompleted is emitted.
- No asynchronous job runner in v1 (upgrade path: queue + worker).

## Inputs
- DAG snapshot (affected node + ancestor chain + relevant edges/relations)
- Closed WIH snapshot
- Closure summary (structured, evidence-linked)
- Receipt refs or bundled receipts (configurable)

## Outputs (Vault)
- snapshots/dag.snapshot.json
- snapshots/wih.closed.json
- closure/closure.summary.json
- receipts/(refs or bundle)
- learning/*.json
- memory_candidates/*.json

## Compaction rules (Hot vs Cold)
Hot (Work/Logistics/Ledger views):
- Keep open WIHs
- Keep active DAG projections (status != CLOSED)
- Keep last N days of events locally for convenience (truth remains in ledger)

Cold (Vault):
- Store full history of closed WIHs + snapshots

## Memory extraction
- Only promote durable user facts/preferences or durable process learnings
- Produce MemoryCandidateExtracted events; gate decides MemoryCommitted
```

---

## 6) CLI surface (Rails runner)
```
# Allternit CLI Contract (v1)

This file defines **commands → gate checks → required emitted events**.
Implementations may vary, but the semantic contract must hold.

## Planning / Intent

### `allternit plan new "<text>" [--project <id>]`
Gate: Gate 0  
Required events:
- PromptCreated
- PromptDeltaAppended (initial baseline)
- DagCreated
- DagNodeCreated (root + initial structure)
- PromptLinkedToWork

### `allternit plan refine <dag_id> --delta "<text>" [--mutations <file>|--mutations-json <json>]`
Required events:
- PromptDeltaAppended
- (0..N) DagNodeCreated / DagNodeUpdated / DagEdgeAdded / DagRelationAdded

Notes:
- In strict provenance mode, every mutation must carry `prompt_id + delta_id` or `agent_decision_id`.
- Prompt deltas and agent decisions must list linked mutation event IDs.

Mutations JSON format:
```json
[
  {
    "op": "create_node",
    "node_id": "n_0002",
    "node_kind": "subtask",
    "title": "Draft ledger schema",
    "parent_node_id": "n_0001",
    "execution_mode": "shared"
  },
  {
    "op": "update_node",
    "node_id": "n_0002",
    "patch": {
      "title": "Draft ledger schema v2",
      "priority": 1
    }
  },
  {
    "op": "add_blocked_by",
    "from_node_id": "n_0002",
    "to_node_id": "n_0003"
  },
  {
    "op": "add_relation",
    "a": "n_0002",
    "b": "n_0004",
    "note": "related but not blocked",
    "context_share": true
  }
]
```

### `allternit plan show <dag_id>`
Reads projection (no events).

### `allternit dag render <dag_id> [--format md|json]`
Reads projection; may emit no-op events only if you choose to log reads (optional).

## Work / WIH

### `allternit wih list --ready [--dag <dag_id>]`
Uses DAG projection readiness derivation (no events).

### `allternit wih pickup <node_id> --dag <dag_id> --agent <agent_id> [--role <role>] [--fresh]`
Gate: Gate 1  
Required events:
- WIHCreated (if absent)
- WIHPickedUp
- (must be completed before tool execution) WIHOpenSigned

Notes:
- `--fresh` forces `execution_mode: fresh` and writes a ContextPack for the WIH.
- `--role` must match `owner_role` when set on the node.

### `allternit wih sign-open <wih_id>`
Required events:
- WIHOpenSigned

### `allternit wih context <wih_id>`
Reads ContextPack if available (no events).

### `allternit wih close <wih_id> --status DONE|FAILED --evidence <ref...>`
Gate: Gate 4 → Gate 5  
Required events:
- WIHCloseRequested
- WIHClosedSigned (gate attestation)
- DagNodeStatusChanged
- WIHArchived
- VaultJobCreated → VaultJobCompleted

## Leases / Reservations

### `allternit lease request <wih_id> --paths "<glob>" [--ttl <sec>]`
Required events:
- LeaseRequested
Followed by:
- LeaseGranted or LeaseDenied

### `allternit lease release <lease_id>`
Required events:
- LeaseReleased

## Mail / Logistics

### `allternit mail thread ensure --topic dag:<dag_id>|wih:<wih_id>`
Required events:
- ThreadCreated (if missing)

Notes:
- `thread_id` is deterministic from topic: `dag:<dag_id>` or `wih:<wih_id>`.

### `allternit mail send <thread_id> --body <file> [--attach <ref...>]`
Required events:
- MessageSent

### `allternit mail request-review <thread_id> --wih <wih_id> --diff <ref>`
Required events:
- ReviewRequested

### `allternit mail decide <thread_id> --approve|--reject --notes <file>`
Required events:
- ReviewDecision

## Ledger / Audit

### `allternit ledger tail [--n 50]`
Reads events.

### `allternit ledger trace --node <node_id>|--wih <wih_id>|--prompt <prompt_id>`
Reads events and correlates provenance.

## Vault

### `allternit vault status`
Reads vault jobs projection.

Flags:
- `--json` outputs a machine-readable summary.

## Gate

### `allternit gate status`
Returns gate configuration and active policy constraints.

### `allternit gate check <wih|run>`
Runs gate checks and returns pass/fail with reasons.

### `allternit gate rules`
Lists active gate rules.

### `allternit gate verify`
Runs invariant verification (optional).

Flags:
- `--json` outputs a machine-readable summary.

### `allternit gate decision "<note>" [--reason <text>] --link <event_id>...`
Records an explicit agent decision with linked mutation event IDs and returns a `decision_id`.

### `allternit gate mutate --dag <dag_id> "<note>" [--reason <text>] --mutations <file>|--mutations-json <json>`
Creates an AgentDecisionRecorded event (with linked mutation IDs) and then emits the
mutations using that decision as provenance.
```

---

## 7) Where Rails stops / where Agent Runner starts

Rails stops at:
- **producing** a work request (DAG node / WIH pointer / required gates)
- enforcing lease + gate rules
- storing receipts/evidence
- maintaining idempotent transitions

Agent Runner starts at:
- building ContextPacks
- selecting prompt packs + injecting policies
- spawning worker agents
- looping (Ralph) until validator gates pass
- reporting outcomes back to Rails

---

## 8) “No drift” rule (hard)
If any system writes durable state outside Rails’ ledger/vault/contracts, that becomes drift. The Agent Runner must treat its local state as *derived/cache*, never canonical.

