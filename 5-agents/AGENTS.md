# DAK Runner — Agent Law

**Version:** 1.0.0  
**Status:** LOCKED  
**Scope:** All agents running under the Deterministic Agent Kernel (DAK)

---

## 1. Non-Negotiable Invariants

### 1.1 Authority Separation

| Plane | Owns | Must NOT Do |
|-------|------|-------------|
| **Rails** (Control) | Ledger, leases, gates, receipts, canonical state | Execute LLM calls, spawn workers |
| **DAK Runner** (Execution) | Hooks, workers, context packs, tool invocation | Write ledger, mint leases as authority |

### 1.2 Tool Execution Rule

Every tool call MUST:
1. Pass through `PreToolUse` gate check via Rails
2. Be validated against ToolRegistry schema
3. Respect WIH `allowed_tools` + lease scope
4. Emit `tool_call_pre` receipt before execution
5. Emit `tool_call_post` or `tool_call_failure` receipt after

**No exceptions.**

### 1.3 Write Discipline

- **Allowed:** Write to `.a2r/runner/{run_id}/` under valid lease
- **Forbidden:** Direct writes to protected paths:
  - `.a2r/ledger/**` (Rails only)
  - `.a2r/leases/**` (Rails only)
  - `.a2r/wih/**` (Rails only)
  - `.a2r/graphs/**` (Rails only)
  - Other runs' receipt directories

### 1.4 Mutual Blocking

- **Builder** produces artifacts
- **Validator** gates completion
- **Builder NEVER self-approves**
- Node is DONE only when `validator_report` == PASS

---

## 2. Role Definitions

### 2.1 Orchestrator

- Spawns workers per DAG/WIH
- Manages Ralph loop (bounded fix cycles)
- Handles escalation to user
- **Constraints:** Read-only on repo, writes only to runner workspace

### 2.2 Builder

- Implements features per WIH spec
- Produces: code, tests, docs, build reports
- **Constraints:** Writes only under lease scope

### 2.3 Validator

- Verifies builder output
- Produces: validator report (PASS/FAIL + required fixes)
- **Constraints:** No writes to repo (read-only validation)

### 2.4 Reviewer

- Human or agent reviewer
- Produces: review decision (APPROVE/REJECT)
- **Constraints:** Cannot modify code directly

### 2.5 Security

- Audits for vulnerabilities
- Produces: security report
- **Constraints:** Read-only analysis

### 2.6 Planner

- Creates and refines plans
- Manages: plan.md, todo.md, progress.md, findings.md
- **Constraints:** Plan files are append-only

---

## 3. Hook Lifecycle (Kernel Stages)

```
SessionStart
    │
    ▼
UserPromptSubmit
    │
    ▼
PreToolUse ───────────→ Gate check (Rails)
    │                          │
    │                    ALLOW │ BLOCK │ TRANSFORM │ REQUIRE_APPROVAL
    │                          │
    ▼                          ▼
ToolExecution ◄────────── Transform args
    │
    ├── Success ───→ PostToolUse
    │
    └── Failure ───→ PostToolUseFailure
                          │
                          ▼
                   Damage control path
                          │
                          ▼
SessionEnd
```

---

## 4. Context Pack Injection

Every worker spawn or context-loss boundary MUST inject:

1. **AGENTS.md** hash (this file)
2. **Policy bundle** (role + execution mode + constraints)
3. **WIH scope** (allowed tools, paths)
4. **Plan artifacts** hash (plan.md, todo.md, etc.)

**Context loss boundaries:**
- New iteration (Ralph loop cycle)
- Subagent spawn
- Post-compaction resume

---

## 5. Receipt Requirements

### Required Receipts (All Roles)

| Receipt | When |
|---------|------|
| `injection_marker` | Context assembled |
| `context_pack_seal` | Context sealed |
| `tool_call_pre` | Before each tool |
| `tool_call_post` | After successful tool |
| `tool_call_failure` | After failed tool |

### Role-Specific Receipts

| Role | Additional Receipts |
|------|---------------------|
| Builder | `build_report` |
| Validator | `validator_report` (must PASS for completion) |
| Security | `security_report` |

---

## 6. Ralph Loop Rules

```
Builder produces
       │
       ▼
Validator checks
       │
   ┌───┴───┐
  PASS    FAIL
   │        │
   │   Fix cycle count < max?
   │        │
   │   ┌────┴────┐
   │  Yes       No
   │   │         │
   ▼   ▼         ▼
  DONE  Retry   Escalate
```

- **Max fix cycles:** 3 (configurable per WIH)
- **Escalation:** On max exceeded or ambiguous failure

---

## 6.1 Ralph Loop Compliance (LAW-AUT Enforcement)

**Authority:** This section implements SYSTEM_LAW.md Part V (LAW-AUT-001 through LAW-AUT-005).

### 6.1.1 No-Stop Execution (LAW-AUT-001)

**Rule:** If DAG has READY work and budget/policy allows, MUST pickup and execute next WIH.

**Implementation:**
```typescript
while (hasReadyNodes() && budgetAllows()) {
  const next = pickNextReadyNode(); // Deterministic: priority, then nodeId lexical
  await executeWIH(next);
  // Do NOT wait for user unless gate explicitly requires
  // Do NOT idle while READY nodes exist
}
```

**Prohibited:**
- "Waiting for user" unless gate explicitly requires (REQUIRE_APPROVAL execution_mode)
- Idling while READY nodes exist
- Terminating loop without explicit policy violation

### 6.1.2 ContextPack Rehydration (LAW-AUT-002)

**Rule:** Every WIH execution MUST begin from sealed ContextPack.

**ContextPack Must Include:**
```typescript
{
  tier0Law: "/SYSTEM_LAW.md", // Full text
  sot: "/SOT.md",
  architecture: "/ARCHITECTURE.md",
  contracts: ["relevant contracts from /spec/Contracts/"],
  deltas: ["relevant deltas from /spec/Deltas/"],
  wih: { wih_id, scope_paths, role, acceptance_refs }
}
```

**ContextPack Seal Must Include:**
```typescript
{
  pack_id: "cp_<sha256_hash>", // Deterministic from inputs
  inputs_manifest: [{path, hash}, ...],
  method_version: "1.0.0",
  created_at: "ISO-8601"
}
```

### 6.1.3 Lease Auto-Renewal (LAW-AUT-003)

**Rule:** Long-running sessions MUST auto-renew leases before expiry.

**Implementation:**
```typescript
const RENEW_THRESHOLD_SECONDS = 60; // Renew at T-60s

setInterval(async () => {
  if (lease.expiresIn < RENEW_THRESHOLD_SECONDS) {
    const result = await rails.lease.renew(lease.id, TTL_SECONDS);
    if (result.denied) {
      // Hard fail to paused state - do NOT continue without lease
      await pauseExecution();
      emitReceipt('lease_renewal_denied', { lease_id: lease.id });
    } else {
      emitReceipt('lease_renewed', { lease_id: lease.id, new_expiry: result.expires_at });
    }
  }
}, RENEW_CHECK_INTERVAL_MS);
```

### 6.1.4 Receipt Queryability (LAW-AUT-004)

**Rule:** System MUST support querying receipts to decide next actions deterministically.

**Required Queries:**
```typescript
// Query receipts by WIH
const receipts = await rails.receipts.query({
  wih_id: wih_id,
  type: 'tool_call_post',
  limit: 100
});

// Query by correlation_id (trace across events)
const trace = await rails.receipts.query({
  correlation_id: corr_id
});

// Ralph Loop MUST query receipts before retrying
const alreadyExecuted = receipts.some(r => r.type === 'tool_call_post' && r.tool_name === tool);
if (alreadyExecuted) {
  // Do NOT re-execute - use cached result
  return useCachedResult(receipts);
}
```

### 6.1.5 PromptDeltaNeeded Escape Hatch (LAW-AUT-005)

**Rule:** If blocked by missing context, MUST emit PromptDeltaNeeded and continue with other READY nodes.

**Required Fields:**
```typescript
{
  type: 'PromptDeltaNeeded',
  dag_id: dag_id,
  node_id: node_id,
  wih_id: wih_id,
  reason_code: 'MISSING_INPUT' | 'AMBIGUOUS_REQUIREMENT' | 'PERMISSION_APPROVAL_REQUIRED' | 'OTHER',
  requested_fields: ['field_name', ...],
  correlation_id: corr_id
}
```

**Ralph Loop Must:**
- Emit PromptDeltaNeeded and continue with other READY nodes
- Never idle on missing context
- Resume blocked WIH when delta is provided

---

## 7. Prohibitions

These are **ABSOLUTE**:

1. **No ledger authority** - Runner cannot write canonical events
2. **No lease forgery** - Runner requests, Rails grants
3. **No self-approval** - Builder cannot validate own work
4. **No bypass** - All tools gated, no exceptions
5. **No drift** - No durable state outside Rails receipts

---

## 8. File Locations

```
agents/
├── AGENTS.md              # This file (law)
├── spec/
│   ├── BRIDGE_RAILS_RUNNER.md
│   ├── DAK_RUNNER_LOCKIN.md
│   ├── WIH_SCHEMA.md
│   └── DAG_SCHEMA.md
├── packs/                 # Prompt packs
├── roles/                 # Role envelopes
├── cookbooks/             # Deterministic procedures
└── primitives/            # Kernel primitives docs
```

---

## 9. Compliance Verification

To verify an agent run complies with this law:

1. Check all tool calls have `PreToolUse` gate receipts
2. Verify no writes outside `.a2r/runner/` without lease
3. Confirm validator PASS before WIH close
4. Validate context injection at each boundary

---

**END OF LAW**
