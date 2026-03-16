# Runner ↔ Rails Event Contract (REC) v1

**Source of truth:** `/mnt/data/a2r-agent-system-rails.zip` (Rails EVENT_TAXONOMY + GATE_RULES + CLI COMMANDS)

<SECTION id="meta">
---
rec_version: 1
status: draft_locked_for_iteration
goal: "Define the minimum canonical messages Runner must send/receive to integrate with Rails without overlapping responsibilities."
principle:
  - "Rails is the only authority for ledger truth, leases, gates, receipts/vault."
  - "Runner is the only authority for agent execution, orchestration, context packs, and hook wrapping."
transport:
  primary: "Rails CLI (today)"
  future: "HTTP API with identical semantics"
ids:
  required_fields: ["dag_id","node_id","wih_id","run_id","iteration_id","correlation_id"]
json_canonicalization: "If signing/hashing, canonicalize JSON keys lexicographically; UTF-8; no floats."
---
</SECTION>

<SECTION id="0_notes">
## 0) Notes on names

Rails’ EVENT_TAXONOMY defines the authoritative categories/names. This doc defines:
- a **minimal stable subset** Runner needs
- canonical field sets + payload schema hints
- mapping to existing Rails CLI verbs (where possible)

If Rails already has a different event name for a concept below, **use Rails’ name** and treat the shape below as the required *payload fields*.

</SECTION>

<SECTION id="1_rails_to_runner">
## 1) Rails → Runner (work discovery)

Runner should not “guess work”. It should consume a projection or queue derived from the ledger.

### 1.1 WorkRequest (projection item)

```json
{
  "type": "WorkRequest",
  "request_id": "wr_{uuid}",
  "dag_id": "{dag_id}",
  "node_id": "{node_id}",
  "wih_id": "{wih_id}",
  "role": "builder|validator|planner|reviewer|security",
  "execution_mode": "PLAN_ONLY|REQUIRE_APPROVAL|ACCEPT_EDITS|BYPASS_PERMISSIONS",
  "priority": 0,
  "deps_satisfied": true,
  "required_gates": ["gate_id_or_name"],
  "required_evidence": ["receipt_kind_or_id"],
  "lease_required": true,
  "lease_scope": {
    "allowed_paths": ["glob"],
    "allowed_tools": ["tool_id"]
  },
  "created_at": "RFC3339",
  "correlation_id": "corr_{uuid}"
}
```

### 1.2 PromptDeltaNeeded (projection item)

```json
{
  "type": "PromptDeltaNeeded",
  "dag_id": "{dag_id}",
  "node_id": "{node_id}",
  "wih_id": "{wih_id}",
  "reason_code": "MISSING_INPUT|AMBIGUOUS_REQUIREMENT|PERMISSION_APPROVAL_REQUIRED|OTHER",
  "requested_fields": ["field_name"],
  "correlation_id": "corr_{uuid}"
}
```

**Rule:** Runner must treat these as read-only. Any state transition must go back through Rails commands/events.

</SECTION>

<SECTION id="2_runner_to_rails">
## 2) Runner → Rails (canonical command/event set)

### 2.1 Claim work (lease handshake)

**Purpose:** ensure concurrency correctness and idempotency.

```json
{
  "type": "WorkRequestClaimed",
  "request_id": "wr_{uuid}",
  "agent_id": "runner:{hostname}:{pid}",
  "claimed_at": "RFC3339",
  "correlation_id": "corr_{uuid}"
}
```

Then Runner requests a lease:
```json
{
  "type": "LeaseRequested",
  "lease_id": "lease_{uuid}",
  "dag_id": "{dag_id}",
  "node_id": "{node_id}",
  "wih_id": "{wih_id}",
  "requested_scope": {
    "paths": ["glob"],
    "tools": ["tool_id"]
  },
  "ttl_s": 900,
  "correlation_id": "corr_{uuid}"
}
```

Rails responds via projection/receipt:
```json
{
  "type": "LeaseGranted|LeaseDenied",
  "lease_id": "lease_{uuid}",
  "reason": "string",
  "expires_at": "RFC3339",
  "correlation_id": "corr_{uuid}"
}
```

### 2.2 Start iteration (bind run + context)

```json
{
  "type": "WorkIterationStarted",
  "run_id": "run_{uuid}",
  "iteration_id": "it_{n}",
  "dag_id": "{dag_id}",
  "node_id": "{node_id}",
  "wih_id": "{wih_id}",
  "role": "builder|validator|...",
  "context_pack_id": "cp_{hash_or_uuid}",
  "policy_bundle_id": "pb_{hash_or_uuid}",
  "lease_id": "lease_{uuid}",
  "execution_mode": "PLAN_ONLY|REQUIRE_APPROVAL|ACCEPT_EDITS|BYPASS_PERMISSIONS",
  "correlation_id": "corr_{uuid}"
}
```

### 2.3 Tool receipts + evidence linking (always via Rails receipts)

Minimum receipt kinds Runner must submit:
- `injection_marker`
- `context_pack_seal`
- `tool_call_pre`
- `tool_call_post`
- `tool_call_failure`
- `policy_decision`
- `validator_report`
- `compaction_summary` (derived)

```json
{
  "type": "ReceiptRecorded",
  "receipt_id": "rcpt_{uuid}",
  "kind": "tool_call_post",
  "run_id": "run_{uuid}",
  "dag_id": "{dag_id}",
  "node_id": "{node_id}",
  "wih_id": "{wih_id}",
  "payload_ref": "vault://… or path under receipts store",
  "hash": "sha256:…",
  "correlation_id": "corr_{uuid}"
}
```

### 2.4 Complete iteration (close-out, request transitions)

```json
{
  "type": "WorkIterationCompleted",
  "run_id": "run_{uuid}",
  "iteration_id": "it_{n}",
  "dag_id": "{dag_id}",
  "node_id": "{node_id}",
  "wih_id": "{wih_id}",
  "outcome": "PASS|FAIL|BLOCKED",
  "validator_verdict_ref": "rcpt_…",
  "evidence_refs": ["rcpt_…"],
  "correlation_id": "corr_{uuid}"
}
```

If outcome is PASS and role is validator, Runner issues:

```json
{
  "type": "WIHCloseRequested",
  "dag_id": "{dag_id}",
  "node_id": "{node_id}",
  "wih_id": "{wih_id}",
  "validator_report_ref": "rcpt_…",
  "correlation_id": "corr_{uuid}"
}
```

If blocked:
```json
{
  "type": "WorkIterationBlocked",
  "dag_id": "{dag_id}",
  "node_id": "{node_id}",
  "wih_id": "{wih_id}",
  "reason_code": "MISSING_INPUT|GATE_DENIED|TEST_FAILURE|POLICY_BLOCK|OTHER",
  "next_action": "PromptDeltaNeeded|Retry|Escalate",
  "correlation_id": "corr_{uuid}"
}
```

Escalation:
```json
{
  "type": "WorkIterationEscalated",
  "dag_id": "{dag_id}",
  "node_id": "{node_id}",
  "wih_id": "{wih_id}",
  "to": "user|human|security",
  "payload_ref": "rcpt_…",
  "correlation_id": "corr_{uuid}"
}
```

</SECTION>

<SECTION id="3_rules">
## 3) Hard rules derived from Rails gate rules

Rails gate rules excerpt (source):
```
# Gate Rules (Enforcement)

## Gate 0 — Plan creation
Trigger: `a2r plan new` or equivalent.
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
Trigger: `a2r wih pickup <node>`
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
Trigger: `a2r wih close`
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

Runner compliance rules:
- DO NOT write outside lease scope.
- DO NOT treat local runner logs as truth; only receipts/vault + ledger are truth.
- Every write-like tool call must have:
  1) active lease
  2) PreToolUse policy decision receipt
  3) PostToolUse result receipt
- Completion requires validator PASS receipt; builder can never close WIH.

</SECTION>

<SECTION id="4_cli_mapping">
## 4) Mapping to Rails CLI (today)

Rails CLI reference (source):
```
# A2R CLI Contract (v1)

This file defines **commands → gate checks → required emitted events**.
Implementations may vary, but the semantic contract must hold.

## Planning / Intent

### `a2r plan new "<text>" [--project <id>]`
Gate: Gate 0  
Required events:
- PromptCreated
- PromptDeltaAppended (initial baseline)
- DagCreated
- DagNodeCreated (root + initial structure)
- PromptLinkedToWork

### `a2r plan refine <dag_id> --delta "<text>" [--mutations <file>|--mutations-json <json>]`
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

### `a2r plan show <dag_id>`
Reads projection (no events).

### `a2r dag render <dag_id> [--format md|json]`
Reads projection; may emit no-op events only if you choose to log reads (optional).

## Work / WIH

### `a2r wih list --ready [--dag <dag_id>]`
Uses DAG projection readiness derivation (no events).

### `a2r wih pickup <node_id> --dag <dag_id> --agent <agent_id> [--role <role>] [--fresh]`
Gate: Gate 1  
Required events:
- WIHCreated (if absent)
- WIHPickedUp
- (must be completed before tool execution) WIHOpenSigned

Notes:
- `--fresh` forces `execution_mode: fresh` and writes a ContextPack for the WIH.
- `--role` must match `owner_role` when set on the node.

### `a2r wih sign-open <wih_id>`
Required events:
- WIHOpenSigned

### `a2r wih context <wih_id>`
Reads ContextPack if available (no events).

### `a2r wih close <wih_id> --status DONE|FAILED --evidence <ref...>`
Gate: Gate 4 → Gate 5  
Required events:
- WIHCloseRequested
- WIHClosedSigned (gate attestation)
- DagNodeStatusChanged
- WIHArchived
- VaultJobCreated → VaultJobCompleted

## Leases / Reservations

### `a2r lease request <wih_id> --paths "<glob>" [--ttl <sec>]`
Required events:
- LeaseRequested
Followed by:
- LeaseGranted or LeaseDenied

### `a2r lease release <lease_id>`
Required events:
- LeaseReleased

## Mail / Logistics

### `a2r mail thread ensure --topic dag:<dag_id>|wih:<wih_id>`
Required events:
- ThreadCreated (if missing)

Notes:
- `thread_id` is deterministic from topic: `dag:<dag_id>` or `wih:<wih_id>`.

### `a2r mail send <thread_id> --body <file> [--attach <ref...>]`
Required events:
- MessageSent

### `a2r mail request-review <thread_id> --wih <wih_id> --diff <ref>`
Required events:
- ReviewRequested

### `a2r mail decide <thread_id> --approve|--reject --notes <file>`
Required events:
- ReviewDecision

## Ledger / Audit

### `a2r ledger tail [--n 50]`
Reads events.

### `a2r ledger trace --node <node_id>|--wih <wih_id>|--prompt <prompt_id>`
Reads events and correlates provenance.

## Vault

### `a2r vault status`
Reads vault jobs projection.

Flags:
- `--json` outputs a machine-readable summary.

## Gate

### `a2r gate status`
Returns gate configuration and active policy constraints.

### `a2r gate check <wih|run>`
Runs gate checks and returns pass/fail with reasons.

### `a2r gate rules`
Lists active gate rules.

### `a2r gate verify`
Runs invariant verification (optional).

Flags:
- `--json` outputs a machine-readable summary.

### `a2r gate decision "<note>" [--reason <text>] --link <event_id>...`
Records an explicit agent decision with linked mutation event IDs and returns a `decision_id`.

### `a2r gate mutate --dag <dag_id> "<note>" [--reason <text>] --mutations <file>|--mutations-json <json>`
Creates an AgentDecisionRecorded event (with linked mutation IDs) and then emits the
mutations using that decision as provenance.
```

Implementation binding guideline:
- Each JSON “type” above maps to a Rails CLI verb or a Rails “emit event” command.
- If Rails CLI does not support a type directly yet, Runner must:
  - store it as a receipt and
  - emit the closest Rails-native event with a reference to that receipt.

This keeps the bridge compatible without forcing new Rails APIs.

</SECTION>

<SECTION id="5_event_name_inventory">
## 5) Event name inventory (extracted)

Extracted tokens from Rails EVENT_TAXONOMY (best-effort list; treat Rails doc as authority):
AgentDecisionRecorded, DagCreated, DagEdgeAdded, DagNodeCreated, DagNodeStatusChanged, DagNodeUpdated, DagRelationAdded, LearningRecorded, LeaseDenied, LeaseGranted, LeaseReleased, LeaseRenewed, LeaseRequested, MemoryCandidateExtracted, MemoryCommitted, MessageSent, PromptCreated, PromptDeltaAppended, PromptLinkedToWork, ReceiptWritten, ReviewDecision, ReviewRequested, RunEnded, RunStarted, ThreadCreated, VaultJobCompleted, VaultJobCreated, WIHArchived, WIHCloseRequested, WIHClosedSigned, WIHCreated, WIHHeartbeat, WIHOpenSigned, WIHPickedUp

</SECTION>
