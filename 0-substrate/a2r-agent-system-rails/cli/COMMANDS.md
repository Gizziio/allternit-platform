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
