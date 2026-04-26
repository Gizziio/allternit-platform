# /spec/layers/hooks/FullSpec.md
# Allternit Hooks System Specification
## Event-Driven Middleware for Enforcement, Automation, and Observability

Status: Canonical  
Layer: L7 Hooks + Cross-Cutting Enforcement  
Scope: Runtime lifecycle, workflows, skills, policy, memory, devices

---

## 1. Purpose

The Hooks System is the **middleware layer** that intercepts lifecycle events and enforces:
- security validation
- governance gates
- observability
- automation
- controlled self-improvement triggers

Hooks are **event-driven** and must not create hidden side-effect paths.
All side effects still go through the Tool Gateway.

---

## 2. Core Principles

1. Hooks are deterministic and auditable
2. Hooks cannot bypass policy
3. Hooks are scoped by tenant/session/workflow/role
4. Hooks are modular and replaceable
5. Hook failures fail safely (configurable)

---

## 3. Placement in Architecture

Hooks subscribe to the Event Bus and attach to:
- Runtime (session start/stop)
- Workflow engine (phase transitions)
- Tool Gateway (pre/post tool use)
- Policy decisions (allow/deny/constraints)
- Memory pipelines (candidate creation/commit)
- Registry events (install/revoke)
- Device events (telemetry/commands)

Hooks run as:
- in-process middleware
- or isolated hook workers
depending on deployment mode.

---

## 4. Canonical Hook Events

Minimum set:
- SessionStart
- SessionEnd
- WorkflowStart
- WorkflowStepStart
- PreToolUse
- PostToolUse
- PolicyDecision
- MemoryCandidateCreated
- MemoryCommitAttempt
- MemoryCommit
- SkillInstall
- SkillEnable
- SkillRevoke
- ProviderRouted
- SubagentStart
- SubagentStop
- DeviceCommandIssued
- DeviceTelemetryReceived
- Stop (hard terminate)

---

## 5. Hook Contract

### 5.1 Input Envelope
Hooks receive:
- event envelope (typed)
- policy snapshot (if available)
- context bundle hash reference (if relevant)
- artifact pointers
- identity + role metadata

Hooks must not receive raw secrets unless explicitly permitted.

### 5.2 Output Envelope
Hooks may output:
- allow/deny override recommendations (never authoritative unless policy engine consumes them)
- constraints suggestions (timeouts, budgets)
- derived artifacts (summaries, metrics)
- new tasks (enqueue) **only** as non-side-effect tasks unless policy allows

---

## 6. Hook Categories

### 6.1 Security Hooks
- pre-exec validation (path allowlists, command sanitization)
- egress filters
- secret scan / leak prevention
- SSRF guardrails

### 6.2 Governance Hooks
- separation-of-duties enforcement signals
- staged promotion triggers
- canary gating

### 6.3 Observability Hooks
- tracing spans
- metrics emission
- structured logs

### 6.4 Automation Hooks
- auto-summarization artifacts
- auto-ticket creation (as artifacts)
- auto-regression test scheduling

### 6.5 Learning Hooks (Triggers Only)
- detect repeated failures
- trigger meta-agent proposal workflow
Hooks do not commit learning changes.

---

## 7. Determinism Rules

- Hook execution order must be explicit and versioned
- Hook outputs must be reproducible from ledger replay
- Non-deterministic hooks (e.g., provider calls) are forbidden unless treated as standard workflow tasks routed via providers

---

## 8. Failure Semantics

Hook failures must be configurable per event type:
- fail_open: continue, record failure
- fail_closed: abort execution
- degrade: downgrade to read-only mode

Security hooks default to fail_closed.

---

## 9. Multi-Tenancy and Isolation

- hooks run per-tenant boundaries
- cannot access other tenants’ events/artifacts
- hook configuration is tenant-scoped with admin controls

---

## 10. Audit Requirements

Every hook execution must write:
- hook_id + version
- input event_id
- output hashes/artifacts
- timing and status
to the History Ledger.

---

## 11. Acceptance Criteria

1) hooks cannot bypass Tool Gateway
2) security hooks can block unsafe execution
3) hook execution is replayable and auditable
4) per-tenant isolation enforced
5) failure semantics behave as configured

---

End of Hooks System Specification
