# Allternit Agent Folder Analysis & DAG Task Integration

**Document Type:** Addendum to MASTER_DAG_TASK_BREAKDOWN.md  
**Date:** 2026-02-20  
**Source:** `/Users/macbook/Desktop/allternit-workspace/allternit/agent/` folder analysis  
**Priority:** P0 - CRITICAL (Agent/Runner architecture is core to system)

---

## Executive Summary

The `/agent/` folder contains **critical Agent Runner / Rails Bridge specifications** that are:
- ✅ More detailed than current SYSTEM_LAW.md in some areas
- ⚠️ Partially redundant with existing LAW
- ❌ Not integrated into constitutional framework
- ❌ Not reflected in DAG tasks

**Key Finding:** The agent folder contains the **missing execution plane specification** that bridges SYSTEM_LAW.md (constitutional) with actual implementation.

---

## Folder Structure Analysis

### Current State

```
/agent/
├── Agentic Prompts/
│   ├── formats/
│   ├── prompt-packs-index-2.md
│   └── prompt-packs-index.md
├── examples/
│   ├── agent_execution_receipt.example.json
│   └── agent_execution_request.example.json
├── spec/
│   ├── AgentRunner_System_Spec_v1.md
│   ├── bridge-rails-runner.md
│   └── dak-runner.md
├── untitled folder/
├── ALLTERNIT_Rails_Ownership_Map_v1.md
├── agent_profiles.json
├── BridgeSpec_AgentRunner_RailsRunner_v1.md
├── BridgeSpec_AgentRunner_RailsRunner_v2.md
├── ClaudeCode_Tools_Hooks_Delta_for_ALLTERNIT_v2.md
├── ClaudeCode_Tools_Hooks_Delta_for_Allternit.md
├── POLICY.md
└── Runner_Rails_Event_Contract_REC_v1.md
```

### Issues Identified

1. **Duplicate Bridge Specs** - v1 and v2 exist simultaneously
2. **Duplicate ClaudeCode Deltas** - v1 and v2 exist simultaneously
3. **"untitled folder"** - Needs cleanup
4. **No clear separation** between constitutional law and implementation specs
5. **POLICY.md** is v0 (draft) - needs promotion to LAW or deprecation

---

## Critical Content Analysis

### 1. POLICY.md (v0)

**Current Status:** Draft policy, not enforced

**Content:**
```markdown
## Non-Negotiable Invariants
- Tool execution only via ToolRegistry
- Tool execution requires full envelope (run_id, graph_id, task_id/node_id, wih_id, write_scope)
- All outputs are run-scoped under `/.allternit/` only
- Forbidden writes: `/.allternit/wih/**`, `/.allternit/graphs/**`, `/.allternit/spec/**`
- PreToolUse gating is mandatory
- Receipts are proofs: tool + node receipts required
- No auth bypass for core endpoints
- No raw exec paths in python gateway
```

**Assessment:** This is **LAW-GRD content**, not policy. Should be integrated into SYSTEM_LAW.md.

**Recommendation:**
- Promote to SYSTEM_LAW.md LAW-GRD-011 through LAW-GRD-015
- OR keep as implementation detail in `/agent/POLICY.md` with header referencing SYSTEM_LAW.md

---

### 2. ALLTERNIT_Rails_Ownership_Map_v1.md

**Current Status:** Authoritative Rails/Runner separation spec

**Key Content:**
```markdown
## What Rails IS (Control Plane)
- Ledger truth (append-only state + provenance)
- Leases (write authority / concurrency)
- Gates (policy + invariants + acceptance checks)
- Receipts / Vault (immutable evidence store + artifacts)
- Idempotent pipelines (replay-safe state transitions)
- Mail (bounded coordination channel)

Rails is NOT the LLM executor.

## What Runner IS (Execution Plane)
- Building ContextPacks
- Selecting prompt packs + injecting policies
- Spawning worker agents
- Looping (Ralph) until validator gates pass
- Reporting outcomes back to Rails
```

**Assessment:** This is **LAW-ONT content** (ontology definitions). Should be in SYSTEM_LAW.md Part IV.

**Recommendation:** Integrate into SYSTEM_LAW.md as LAW-ONT-011 (Rails/Runner Separation Law)

---

### 3. BridgeSpec_AgentRunner_RailsRunner_v2.md

**Current Status:** v2 is current, v1 is superseded

**Key Content:**
```markdown
## Non-negotiable separation
- Rails (control plane): ledger truth, gates, leases, receipts/vault, idempotent pipelines
- Agent Runner (execution plane): prompt packs, policy injection, context packs, worker orchestration, Ralph loop, compaction, observability

Agent Runner must NEVER write canonical state outside Rails.

## Bridge interface primitives
### Rails → Runner: "execute this work item"
- WorkRequestCreated (dag_id, node_id, wih_path, role, execution_mode, required_gates, required_receipts)

### Runner → Rails: "claim / start / evidence / outcome"
- WorkRequestClaimed
- WorkIterationStarted
- ReceiptRecorded
- WorkIterationCompleted
- WorkIterationBlocked
- WorkIterationEscalated
```

**Assessment:** This is **LAW-SWM content** (Swarm Orchestration). Should be in SYSTEM_LAW.md Part IX.

**Recommendation:** Integrate into SYSTEM_LAW.md as LAW-SWM-010 through LAW-SWM-015

---

### 4. Runner_Rails_Event_Contract_REC_v1.md

**Current Status:** Canonical event contract

**Key Content:**
```xml
<SECTION id="meta">
rec_version: 1
goal: "Define the minimum canonical messages Runner must send/receive"
principle:
  - "Rails is the only authority for ledger truth, leases, gates, receipts/vault"
  - "Runner is the only authority for agent execution, orchestration, context packs, and hook wrapping"
</SECTION>

## Event Types Defined
- WorkRequest (Rails → Runner)
- WorkRequestClaimed (Runner → Rails)
- LeaseRequested/LeaseGranted/LeaseDenied
- WorkIterationStarted
- ReceiptRecorded (with kinds: injection_marker, context_pack_seal, tool_call_pre, tool_call_post, tool_call_failure, policy_decision, validator_report, compaction_summary)
- WorkIterationCompleted
- WorkIterationBlocked
- WorkIterationEscalated
```

**Assessment:** This is **LAW-ENF content** (Canonical Event Schema). Should be in SYSTEM_LAW.md.

**Recommendation:** Integrate into SYSTEM_LAW.md as LAW-ENF-009 (Runner-Rails Event Contract)

---

### 5. ClaudeCode_Tools_Hooks_Delta_for_ALLTERNIT_v2.md

**Current Status:** Tool/Hooks taxonomy

**Key Content:**
```markdown
## Tool surface (Claude Code baseline)
| Tool | Permission | Allternit Risk Tier |
|------|------------|---------------|
| Bash | Yes | High (gate via PolicyEngine) |
| Edit | Yes | Medium (enforce allowed_paths) |
| Glob | No | Low (read-only) |
| Grep | No | Low (read-only) |
| Read | No | Low (read-only) |
| Write | Yes | Medium (enforce workspace) |
| WebFetch | Yes | Variable (snapshot for replay) |
| WebSearch | Yes | Variable (snapshot results) |
| Task | No | Spawns subagent → WorkerManager.spawn() |

## Hook lifecycle events
- SessionStart
- UserPromptSubmit
- PreToolUse (HARD CHOKE POINT)
- PostToolUse
- PostToolUseFailure
- Notification
- Stop
- SubagentStop
- PreCompact
- SessionEnd
```

**Assessment:** This is **LAW-TOOL content** (Tool Capability Classification). Should be in SYSTEM_LAW.md Part VIII.

**Recommendation:** Integrate into SYSTEM_LAW.md as LAW-TOOL-003 (Tool Permission Classification) and LAW-HOOK-001 (Hook Lifecycle)

---

### 6. AgentRunner_System_Spec_v1.md

**Current Status:** Implementation spec for Agent Runner

**Key Content:**
```markdown
## Proposed repo layout
/agent/
  runner/
    agent-runner.ts
    claim_store.sqlite
  packs/
    index.md (Prompt Pack Index)
    templates/
    schemas/
    cookbook/
  policy/
    bundle_builder.ts
    injection_marker.ts
  context/
    builder.ts
    slicer.ts
    seal.ts
  hooks/
    runtime.ts (stage dispatcher)
  tools/
    registry.ts
    enforce.ts
  policy_engine/
    engine.ts
  loop/
    ralph.ts (iteration state machine)
  workers/
    worker_manager.ts
  observability/
    events.jsonl
```

**Assessment:** This is **implementation spec**, not constitutional law. Should remain in `/agent/spec/` but referenced from SYSTEM_LAW.md.

**Recommendation:** Keep as implementation spec, add reference in SYSTEM_LAW.md Appendix

---

### 7. bridge-rails-runner.md

**Current Status:** Detailed bridge specification

**Key Content:**
```markdown
## Authority model (non-negotiable)
### Rails is authoritative for
- ledger truth
- lease issuance
- gate decisions
- receipt/blob authority

### Runner is authoritative for
- spawning and supervising worker processes
- provider-level hook capture/normalization
- producing artifacts/reports under strict constraints

## Tool call lifecycle (hard gating)
### PreToolUse gate contract
Runner calls gate.check({...})
Rails evaluates:
1) tool allowed by WIH scope
2) args validate against tool schema
3) PolicyEngine decision: ALLOW | BLOCK | TRANSFORM | REQUIRE_APPROVAL
4) path guard + protected paths
5) concurrency/lease guard
6) emit gate decision event

### PostToolUse commit contract
Runner calls gate.commit({...})
Rails records receipts/blobs/events
```

**Assessment:** This is **LAW-SWM + LAW-ENF content**. Should be integrated into SYSTEM_LAW.md.

**Recommendation:** Integrate into SYSTEM_LAW.md as LAW-SWM-011 (Tool Call Lifecycle) and LAW-ENF-010 (Gate Contract)

---

### 8. dak-runner.md

**Current Status:** DAK Runner lock-in spec

**Key Content:**
```markdown
## Status: LOCKED

## Planes and separation
### Rails (Control Plane) owns
- Ledger truth
- Leases / locks
- Receipts authority
- Gate decisions
- Idempotent pipelines

### Agent Runner (Execution Plane) owns
- Orchestration runtime
- Provider adapters + hook normalization
- ContextPack compiler
- Prompt packs + cookbooks + role envelopes
- Planning-with-files behavior
- Output hygiene (anti-drift)

## Critical invariants
- Every tool-like action MUST be preceded by Rails gate check
- Every tool-like action MUST emit pre/post events
- Validator decides completion; builder never self-approves
- Determinism is constraint-level
```

**Assessment:** This is **LAW-META content** (Agentic Framework). Should be in SYSTEM_LAW.md Part III.

**Recommendation:** Integrate into SYSTEM_LAW.md as LAW-META-009 (DAK Runner Lock-In)

---

### 9. agent_profiles.json

**Current Status:** Agent profile definitions

**Key Content:**
```json
{
  "profiles": [
    {
      "id": "kernel-default",
      "write_scope_policy": {
        "mode": "run_scoped",
        "allowed_globs": ["/.allternit/artifacts/{{run_id}}/**"]
      },
      "network_policy": "none",
      "receipts_required": true
    },
    {
      "id": "builder",
      "worker_allowlist": ["git.diff", "git.status"],
      "write_scope_policy": {
        "mode": "run_scoped"
      }
    }
  ]
}
```

**Assessment:** This is **implementation config**, not constitutional law. Should remain in `/agent/` but schema should be referenced from SYSTEM_LAW.md.

**Recommendation:** Keep as implementation config, add schema reference in SYSTEM_LAW.md LAW-TOOL-002

---

## Files to Add to SYSTEM_LAW.md

### New Laws to Add

| Source File | Content | SYSTEM_LAW.md Location |
|-------------|---------|----------------------|
| POLICY.md | Tool execution invariants | LAW-GRD-011 to LAW-GRD-015 |
| ALLTERNIT_Rails_Ownership_Map_v1.md | Rails/Runner separation | LAW-ONT-011 |
| BridgeSpec_v2.md | Bridge interface primitives | LAW-SWM-010 to LAW-SWM-015 |
| Runner_Rails_Event_Contract_REC_v1.md | Event contract | LAW-ENF-009 |
| ClaudeCode_Tools_Hooks_Delta_v2.md | Tool permission classification | LAW-TOOL-003, LAW-HOOK-001 |
| bridge-rails-runner.md | Tool call lifecycle, gate contract | LAW-SWM-011, LAW-ENF-010 |
| dak-runner.md | DAK Runner lock-in | LAW-META-009 |

---

## New DAG Tasks

### P0.10: Agent Folder Integration (NEW - Week 1)

**Priority:** P0 - CRITICAL  
**Effort:** 3 days  
**Dependencies:** P0.1 (LAW Consolidation) ✅  
**Owner:** Architecture Team

**Rationale:** Agent folder contains critical specs that must be integrated into constitutional framework.

**Subtasks:**
- [ ] 0.10.1: Clean up duplicate files (remove v1 BridgeSpec, v1 ClaudeCode Delta)
- [ ] 0.10.2: Remove "untitled folder" or organize contents
- [ ] 0.10.3: Promote POLICY.md content to SYSTEM_LAW.md (LAW-GRD-011 to 015)
- [ ] 0.10.4: Integrate Rails Ownership Map into SYSTEM_LAW.md (LAW-ONT-011)
- [ ] 0.10.5: Integrate Bridge Spec into SYSTEM_LAW.md (LAW-SWM-010 to 015)
- [ ] 0.10.6: Integrate Event Contract into SYSTEM_LAW.md (LAW-ENF-009)
- [ ] 0.10.7: Integrate Tool/Hooks taxonomy into SYSTEM_LAW.md (LAW-TOOL-003, LAW-HOOK-001)
- [ ] 0.10.8: Integrate DAK Runner spec into SYSTEM_LAW.md (LAW-META-009)
- [ ] 0.10.9: Update LAW_INDEX.md with new sections
- [ ] 0.10.10: Create `/agent/README.md` explaining folder purpose

**Acceptance Criteria:**
- Duplicate files removed
- All constitutional content in SYSTEM_LAW.md
- Implementation specs remain in `/agent/` with proper headers
- LAW_INDEX.md updated

---

### P1.11: Agent Runner Implementation (NEW - Week 4-6)

**Priority:** P1 - HIGH  
**Effort:** 3 weeks  
**Dependencies:** P0.10, P1.1 (Policy Engine)  
**Owner:** Backend Team

**Rationale:** Agent Runner is the execution plane. Must be implemented per specs.

**Subtasks:**
- [ ] 1.11.1: Create `/agent/runner/` directory structure per AgentRunner_System_Spec_v1.md
- [ ] 1.11.2: Implement agent-runner.ts main loop (poll → claim → execute → report)
- [ ] 1.11.3: Implement claim_store.sqlite (idempotent claim tracking)
- [ ] 1.11.4: Implement ContextPack builder (`/agent/context/builder.ts`)
- [ ] 1.11.5: implement Policy Bundle Builder (`/agent/policy/bundle_builder.ts`)
- [ ] 1.11.6: Implement Hook Runtime (`/agent/hooks/runtime.ts`)
- [ ] 1.11.7: Implement Ralph Loop (`/agent/loop/ralph.ts`)
- [ ] 1.11.8: Implement Worker Manager (`/agent/workers/worker_manager.ts`)
- [ ] 1.11.9: Implement Rails API adapter (`/agent/adapters/rails_api.ts`)
- [ ] 1.11.10: Create Prompt Pack Index (`/agent/packs/index.md`)

**Acceptance Criteria:**
- Agent Runner can poll for work
- ContextPacks built deterministically
- Hooks fire correctly (SessionStart → SessionEnd)
- Ralph loop enforces bounded fix cycles
- All receipts emitted to Rails

---

### P1.12: Rails-Runner Bridge Implementation (NEW - Week 5-7)

**Priority:** P1 - HIGH  
**Effort:** 3 weeks  
**Dependencies:** P1.11, P2.1 (Swarm Scheduler)  
**Owner:** Backend Team

**Rationale:** Bridge between Rails control plane and Runner execution plane.

**Subtasks:**
- [ ] 1.12.1: Implement WorkRequestCreated event emission (Rails → Runner)
- [ ] 1.12.2: Implement WorkRequestClaimed (Runner → Rails)
- [ ] 1.12.3: Implement lease handshake protocol
- [ ] 1.12.4: Implement gate.check() endpoint (Rails)
- [ ] 1.12.5: Implement gate.commit() endpoint (Rails)
- [ ] 1.12.6: Implement gate.fail() endpoint (Rails)
- [ ] 1.12.7: Implement ReceiptRecorded event
- [ ] 1.12.8: Implement WorkIterationCompleted/Blocked/Escalated events
- [ ] 1.12.9: Create integration tests for bridge protocol
- [ ] 1.12.10: Document bridge API in `/agent/spec/BRIDGE_API.md`

**Acceptance Criteria:**
- Rails can dispatch work to Runner
- Runner can claim work idempotently
- All gate checks flow through Rails
- Receipts stored in Rails vault
- Integration tests pass

---

### P2.12: Prompt Pack System (NEW - Week 9-10)

**Priority:** P2 - MEDIUM  
**Effort:** 2 weeks  
**Dependencies:** P1.11  
**Owner:** Full Stack Team

**Rationale:** Prompt packs are versioned, indexed templates for agent execution.

**Subtasks:**
- [ ] 2.12.1: Create Prompt Pack schema (`/agent/packs/schemas/pack.schema.json`)
- [ ] 2.12.2: Implement Prompt Pack Index (`/agent/packs/index.md`)
- [ ] 2.12.3: Create template formats (`/agent/packs/formats/`)
- [ ] 2.12.4: Implement cookbook system (`/agent/packs/cookbook/`)
- [ ] 2.12.5: Create role envelopes (`/agent/roles/`)
- [ ] 2.12.6: Implement injection marker receipt
- [ ] 2.12.7: Create Prompt Pack UI browser
- [ ] 2.12.8: Implement versioning system
- [ ] 2.12.9: Create Prompt Pack validation tests
- [ ] 2.12.10: Document Prompt Pack usage

**Acceptance Criteria:**
- Prompt packs are versioned and indexed
- Templates follow strict format
- Role envelopes defined
- Injection markers emitted
- UI browser functional

---

### P2.13: Claude Code Integration (NEW - Week 10-11)

**Priority:** P2 - MEDIUM  
**Effort:** 2 weeks  
**Dependencies:** P1.11, P1.2 (Tool Wrapper)  
**Owner:** Backend Team

**Rationale:** Claude Code tools/hooks must be integrated into Allternit ToolRegistry.

**Subtasks:**
- [ ] 2.13.1: Map Claude Code tools to Allternit ToolRegistry
- [ ] 2.13.2: Implement tool permission classification (LAW-TOOL-003)
- [ ] 2.13.3: Implement hook lifecycle (SessionStart → SessionEnd)
- [ ] 2.13.4: Implement PreToolUse gate (hard choke point)
- [ ] 2.13.5: Implement PostToolUse evidence capture
- [ ] 2.13.6: Implement WebFetch snapshot for replay
- [ ] 2.13.7: Implement WebSearch snapshot with domain filters
- [ ] 2.13.8: Implement Task tool (subagent spawn)
- [ ] 2.13.9: Implement TodoWrite (planning-with-files)
- [ ] 2.13.10: Create Claude Code adapter (`/agent/hooks/claude_code_adapter.ts`)

**Acceptance Criteria:**
- All Claude Code tools mapped
- Hook lifecycle fires correctly
- PreToolUse gate enforced
- WebFetch/WebSearch snapshots stored
- Subagent spawn works

---

### P3.10: Agent Observability & Replay (NEW - Week 16-18)

**Priority:** P3 - STRATEGIC  
**Effort:** 3 weeks  
**Dependencies:** P2.9 (Cache Observability), P1.11  
**Owner:** Full Stack Team

**Rationale:** Agent execution must be observable and replayable.

**Subtasks:**
- [ ] 3.10.1: Implement run event logging (`/agent/observability/events.jsonl`)
- [ ] 3.10.2: Implement event ingest server
- [ ] 3.10.3: Create run diff tool (`/agent/observability/diff.ts`)
- [ ] 3.10.4: Create deterministic replay tool (`/agent/observability/replay.ts`)
- [ ] 3.10.5: Implement run manifest (`run_manifest.json`)
- [ ] 3.10.6: Create observability dashboard UI
- [ ] 3.10.7: Implement correlation ID tracking
- [ ] 3.10.8: Create replay tests
- [ ] 3.10.9: Document observability system
- [ ] 3.10.10: Create run visualization UI

**Acceptance Criteria:**
- All runs logged
- Runs can be diffed
- Deterministic replay works
- Dashboard shows run history
- Correlation IDs trace across events

---

## Updated DAG Overview

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Total Tasks** | 165 | 175 | +10 |
| **P0 Tasks** | 9 | 10 | +1 |
| **P1 Tasks** | 20 | 23 | +3 |
| **P2 Tasks** | 39 | 41 | +2 |
| **P3 Tasks** | 87 | 88 | +1 |
| **Modified Tasks** | 7 | 7 | No change |

---

## Updated Timeline

| Phase | Original | Revised | Change |
|-------|----------|---------|--------|
| **Phase 0** (LAW + Harness) | Week 1-4 | Week 1-4 | +3 days (P0.10) |
| **Phase 1** (Core Services) | Week 5-11 | Week 5-13 | +2 weeks (P1.11, P1.12) |
| **Phase 2** (Swarm + UI) | Week 12-22 | Week 14-24 | +2 weeks (P2.12, P2.13) |
| **Phase 3** (Advanced) | Week 23-28 | Week 25-30 | +2 weeks (P3.10) |
| **Buffer** | Week 29-32 | Week 31-34 | +2 weeks |
| **TOTAL** | **32 weeks** | **34 weeks** | **+2 weeks** |

---

## Critical Path Impact

### New Critical Path Tasks

```
P0.10: Agent Folder Integration (3 days)
    ↓
P1.11: Agent Runner Implementation (3 weeks)
    ↓
P1.12: Rails-Runner Bridge (3 weeks)
    ↓
P2.13: Claude Code Integration (2 weeks)
    ↓
P3.10: Agent Observability (3 weeks)
    ↓
MVP (Week 34)
```

---

## SYSTEM_LAW.md Updates Required

### New Sections to Add

**Part I: Guardrails (extend)**
- LAW-GRD-011: Tool Execution Only via ToolRegistry
- LAW-GRD-012: Full Envelope Requirement
- LAW-GRD-013: Run-Scoped Outputs
- LAW-GRD-014: Forbidden Writes
- LAW-GRD-015: Receipts as Proofs

**Part III: Agentic Framework (extend)**
- LAW-META-009: DAK Runner Lock-In

**Part IV: Ontology (extend)**
- LAW-ONT-011: Rails/Runner Separation Law

**Part VIII: Tool Governance (extend)**
- LAW-TOOL-003: Tool Permission Classification
- LAW-HOOK-001: Hook Lifecycle Law

**Part IX: Swarm Orchestration (extend)**
- LAW-SWM-010: Bridge Interface Primitives
- LAW-SWM-011: Tool Call Lifecycle
- LAW-SWM-012: Lease + Gate Interplay
- LAW-SWM-013: Evidence & Receipts
- LAW-SWM-014: DAG Node Execution Semantics
- LAW-SWM-015: Permission Escalation

**Part XI: Enforcement (extend)**
- LAW-ENF-009: Runner-Rails Event Contract
- LAW-ENF-010: Gate Contract Specification

---

## Folder Cleanup Actions

### Immediate (Week 1)

| Action | Files | Status |
|--------|-------|--------|
| Remove superseded v1 files | BridgeSpec_v1.md, ClaudeCode_Delta_v1.md | ⏳ Pending |
| Organize "untitled folder" | Contents TBD | ⏳ Pending |
| Add README.md to /agent/ | Explains folder purpose | ⏳ Pending |
| Add authority headers | All retained specs | ⏳ Pending |

### Week 2-4

| Action | Files | Status |
|--------|-------|--------|
| Integrate constitutional content | To SYSTEM_LAW.md | ⏳ Pending |
| Create implementation specs | /agent/spec/ | ⏳ Pending |
| Set up runner directory structure | /agent/runner/ | ⏳ Pending |

---

## Success Criteria

### Technical

- [ ] All constitutional content in SYSTEM_LAW.md
- [ ] Implementation specs properly organized in `/agent/`
- [ ] Duplicate files removed
- [ ] Agent Runner implemented per spec
- [ ] Rails-Runner bridge functional
- [ ] All hooks fire correctly
- [ ] Receipts emitted to Rails
- [ ] Deterministic replay works

### Documentation

- [ ] `/agent/README.md` explains folder purpose
- [ ] All specs have authority headers
- [ ] LAW_INDEX.md updated
- [ ] Bridge API documented
- [ ] Prompt Pack usage documented
- [ ] Observability system documented

---

**End of Agent Folder DAG Addendum**
