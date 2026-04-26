# BRIDGE_RAILS_RUNNER.md — Rails ↔ Agent Runner Bridge Specification

**Version:** 1.0.0  
**Status:** LOCKED  
**Date:** 2026-02-08  

## Purpose

Define the canonical interface contract between the Rails control plane (ledger, gates, leases, receipts) and the Agent Runner execution plane (orchestration, hooks, workers, prompt packs).

This spec ensures:
- **Rails remains the sole authority** for ledger truth, gates, and durable state
- **Agent Runner remains the execution kernel** for LLM work, tool invocation, and worker orchestration
- **No drift**: All state mutations flow through Rails APIs

---

## 1. Shared Vocabulary

### Identifiers

| Field | Format | Description |
|-------|--------|-------------|
| `dag_id` | `dag_{uuid}` | DAG identifier |
| `node_id` | `n_{4digit}` | DAG node identifier (e.g., `n_0001`) |
| `wih_id` | `wih_{uuid}` | Work Item Header identifier |
| `run_id` | `run_{uuid}` | Execution run identifier |
| `iteration_id` | `it_{n}` | Ralph loop / fix cycle identifier |
| `agent_id` | `{role}:{uuid}` | Worker identity (e.g., `builder:abc123`) |
| `correlation_id` | `corr_{uuid}` | Message correlation for tracing |
| `context_pack_id` | `cp_{hash}` | Sealed context pack identifier |
| `policy_bundle_id` | `pb_{hash}` | Policy bundle hash |
| `lease_id` | `lease_{uuid}` | Lease identifier |
| `receipt_id` | `rcpt_{uuid}` | Receipt identifier |

### Execution Modes

| Mode | Description |
|------|-------------|
| `PLAN_ONLY` | Read-only planning, no writes |
| `REQUIRE_APPROVAL` | All writes require explicit approval |
| `ACCEPT_EDITS` | Allowlisted edits auto-approved |
| `BYPASS_PERMISSIONS` | Dangerous mode (org-disableable) |

### Roles

| Role | Responsibility |
|------|----------------|
| `orchestrator` | Spawn workers, manage Ralph loop |
| `builder` | Produce artifacts/code |
| `validator` | Verify builder output (gates completion) |
| `reviewer` | Human-in-the-loop review |
| `security` | Security audit and approval |
| `planner` | Create and refine plans |

---

## 2. Authority Model (Non-Negotiable)

### Rails Owns (Control Plane)

- **Ledger truth**: Append-only event log
- **Lease authority**: Grant/deny/renew locks
- **Gate decisions**: PreToolUse/PostToolUse validation
- **Receipt/blob authority**: Immutable evidence storage
- **Canonical state transitions**: Idempotent workflow state

### Agent Runner Owns (Execution Plane)

- **Worker lifecycle**: Spawn, supervise, terminate workers
- **Hook runtime**: SessionStart → PreToolUse → PostToolUse → SessionEnd
- **ContextPack compilation**: Deterministic bundle from Rails truth
- **Prompt packs**: Versioned, indexed prompts
- **Tool invocation**: Executing tools (gated through Rails)
- **Observability**: Pre/post tool events, gate decisions

### Agent Runner MUST NOT

- Write canonical state outside Rails APIs
- Author ledger events directly
- Mint leases as authority
- Self-approve work (builder → validator separation)

---

## 3. Work Discovery & Claiming

### 3.1 Work Request (Rails → Runner)

```json
{
  "type": "WorkRequest",
  "request_id": "wr_{uuid}",
  "dag_id": "dag_{uuid}",
  "node_id": "n_0001",
  "wih_id": "wih_{uuid}",
  "role": "builder|validator|planner|reviewer|security",
  "execution_mode": "PLAN_ONLY|REQUIRE_APPROVAL|ACCEPT_EDITS|BYPASS_PERMISSIONS",
  "priority": 0,
  "deps_satisfied": true,
  "required_gates": ["gate_id"],
  "required_evidence": ["receipt_kind"],
  "lease_required": true,
  "lease_scope": {
    "allowed_paths": ["glob"],
    "allowed_tools": ["tool_id"]
  },
  "created_at": "2026-02-08T15:00:00Z",
  "correlation_id": "corr_{uuid}"
}
```

### 3.2 Claim Protocol

Runner claims work via Rails leases:

1. **Request lease**:
   ```json
   {
     "type": "LeaseRequested",
     "lease_id": "lease_{uuid}",
     "key": "spawn/{dag_id}/{node_id}/{wih_id}",
     "holder": "{agent_id}",
     "ttl_s": 900,
     "requested_scope": {
       "paths": ["glob"],
       "tools": ["tool_id"]
     },
     "correlation_id": "corr_{uuid}"
   }
   ```

2. **Rails responds**:
   ```json
   {
     "type": "LeaseGranted|LeaseDenied",
     "lease_id": "lease_{uuid}",
     "expires_at": "2026-02-08T15:15:00Z",
     "reason": "string",
     "correlation_id": "corr_{uuid}"
   }
   ```

3. **Runner MUST**: Renew lease while running, release on completion

---

## 4. ContextPack Specification

### 4.1 ContextPack Inputs

Runner builds ContextPack from Rails truth:

| Component | Source | Description |
|-----------|--------|-------------|
| `wih_content` | Rails WIH | Work Item Header content |
| `dag_slice` | Rails DAG | Node + hard deps + ancestors |
| `receipts_slice` | Rails receipts | Evidence from dependencies |
| `policy_bundle` | AGENTS.md + packs | Policy hash + pack refs |
| `plan_artifacts` | plan.md, todo.md | Hashed plan state |
| `tool_registry` | Version pin | Tool schema digest |
| `lease_info` | Active lease | Scope + expiry |

### 4.2 ContextPack Seal

```json
{
  "context_pack_id": "cp_{sha256}",
  "method_version": "1.0.0",
  "created_at": "2026-02-08T15:00:00Z",
  "inputs": {
    "wih_id": "wih_{uuid}",
    "dag_id": "dag_{uuid}",
    "node_id": "n_0001",
    "receipt_refs": ["rcpt_{uuid}"],
    "policy_bundle_id": "pb_{hash}",
    "plan_hashes": {
      "plan.md": "sha256:...",
      "todo.md": "sha256:..."
    }
  },
  "correlation_id": "corr_{uuid}"
}
```

---

## 5. Tool Call Lifecycle (Hard Gating)

### 5.1 PreToolUse Gate Check

Runner MUST call Rails before ANY tool execution:

```json
{
  "type": "GateCheckRequest",
  "check_id": "chk_{uuid}",
  "wih_id": "wih_{uuid}",
  "dag_id": "dag_{uuid}",
  "node_id": "n_0001",
  "iteration_id": "it_0",
  "actor": {
    "agent_id": "builder:abc123",
    "role": "builder"
  },
  "tool": {
    "name": "Bash|Edit|Write|Read|...",
    "args": {"command": "...", "path": "..."},
    "intended_paths": ["path"]
  },
  "context": {
    "policy_bundle_id": "pb_{hash}",
    "context_pack_id": "cp_{hash}",
    "lease_id": "lease_{uuid}"
  },
  "correlation_id": "corr_{uuid}"
}
```

### 5.2 Gate Decision

Rails responds with:

```json
{
  "type": "GateDecision",
  "check_id": "chk_{uuid}",
  "decision": "ALLOW|BLOCK|TRANSFORM|REQUIRE_APPROVAL",
  "reason": "string",
  "transformed_args": {},
  "correlation_id": "corr_{uuid}"
}
```

### 5.3 Execution Rules

| Decision | Runner Action |
|----------|---------------|
| `ALLOW` | Execute tool with original args |
| `BLOCK` | Do not execute; record block outcome |
| `TRANSFORM` | Execute with transformed args only |
| `REQUIRE_APPROVAL` | Halt; emit PermissionRequest |

### 5.4 PostToolUse Commit

After execution:

```json
{
  "type": "ToolCommit",
  "check_id": "chk_{uuid}",
  "result": {
    "stdout_ref": "blob://...",
    "stderr_ref": "blob://...",
    "exit_code": 0,
    "produced_paths": ["path"],
    "produced_hashes": {"path": "sha256:..."}
  },
  "receipt_ids": ["rcpt_{uuid}"],
  "correlation_id": "corr_{uuid}"
}
```

### 5.5 PostToolUse Failure

On error:

```json
{
  "type": "ToolFailure",
  "check_id": "chk_{uuid}",
  "error": {
    "message": "...",
    "class": "ToolExecutionError",
    "stderr_ref": "blob://..."
  },
  "affected_paths": ["path"],
  "correlation_id": "corr_{uuid}"
}
```

---

## 6. Receipts & Evidence

### 6.1 Required Receipt Kinds

| Kind | When Emitted |
|------|--------------|
| `injection_marker` | Context pack assembled |
| `context_pack_seal` | Context pack sealed |
| `tool_call_pre` | Before tool execution |
| `tool_call_post` | After successful execution |
| `tool_call_failure` | After failed execution |
| `policy_decision` | Policy engine decision |
| `validator_report` | Validator completes |
| `compaction_summary` | Context compaction done |

### 6.2 Receipt Format

```json
{
  "type": "ReceiptRecorded",
  "receipt_id": "rcpt_{uuid}",
  "kind": "tool_call_post",
  "run_id": "run_{uuid}",
  "dag_id": "dag_{uuid}",
  "node_id": "n_0001",
  "wih_id": "wih_{uuid}",
  "provenance": {
    "agent_id": "builder:abc123",
    "role": "builder",
    "iteration_id": "it_0"
  },
  "inputs": {
    "context_pack_id": "cp_{hash}",
    "policy_bundle_id": "pb_{hash}"
  },
  "payload_ref": "vault://...",
  "hash": "sha256:...",
  "correlation_id": "corr_{uuid}"
}
```

---

## 7. DAG Node Execution Semantics

### 7.1 Builder/Validator Mutual Blocking

```
┌─────────────┐     ┌─────────────┐
│   Builder   │────→│  Validator  │
│   Worker    │     │   Worker    │
└─────────────┘     └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   PASS →   │──→ WIH Close Request
                    │   FAIL →   │──→ Ralph Loop (bounded)
                    └─────────────┘
```

### 7.2 Completion Rule

A node is DONE iff ALL of:
- `validator_report` == PASS
- Declared tests pass
- No policy violations
- Required evidence receipts attached

### 7.3 Ralph Loop (Bounded Fix Cycles)

```
Builder produces → Validator checks
                        │
               ┌────────┴────────┐
              PASS              FAIL
               │                  │
          Node DONE ←──── Fix cycle (max 3)
                           │
                      Builder retry
```

---

## 8. Escalation & User Input

### 8.1 Permission Request

```json
{
  "type": "PermissionRequest",
  "request_id": "perm_{uuid}",
  "wih_id": "wih_{uuid}",
  "tool": {"name": "...", "args": {}},
  "reason": "Gate returned REQUIRE_APPROVAL",
  "correlation_id": "corr_{uuid}"
}
```

### 8.2 Prompt Delta Needed

```json
{
  "type": "PromptDeltaNeeded",
  "dag_id": "dag_{uuid}",
  "node_id": "n_0001",
  "wih_id": "wih_{uuid}",
  "reason_code": "MISSING_INPUT|AMBIGUOUS_REQUIREMENT|OTHER",
  "requested_fields": ["field"],
  "correlation_id": "corr_{uuid}"
}
```

---

## 9. Rails CLI Mapping

| Bridge Concept | Rails CLI Command |
|----------------|-------------------|
| Lease request | `allternit lease request <wih_id> --paths "<glob>"` |
| Lease release | `allternit lease release <lease_id>` |
| Gate check | `allternit gate check <wih_id>` |
| Work pickup | `allternit wih pickup <node_id> --dag <dag_id>` |
| WIH close | `allternit wih close <wih_id> --status DONE` |
| Receipt query | `allternit ledger trace --wih <wih_id>` |

---

## 10. File Layout

```
agents/
├── spec/
│   ├── BRIDGE_RAILS_RUNNER.md    # This file
│   ├── WIH_SCHEMA.md             # WIH structure
│   ├── DAG_SCHEMA.md             # DAG structure
│   └── DAK_RUNNER_LOCKIN.md      # DAK spec
├── packs/                        # Prompt packs
├── roles/                        # Role envelopes
└── cookbooks/                    # Deterministic procedures

.allternit/runner/                      # Runner workspace
├── context_packs/                # Sealed context packs
├── runs/{run_id}/                # Run artifacts
└── receipts/                     # Receipt cache
```

---

## 11. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-08 | Initial locked spec |

---

**END OF SPECIFICATION**
