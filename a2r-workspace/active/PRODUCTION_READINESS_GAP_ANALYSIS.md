# PRODUCTION READINESS GAP ANALYSIS

**Date:** 2026-02-23
**Basis:** SYSTEM_LAW.md requirements
**Status:** CRITICAL GAPS IDENTIFIED

---

## EXECUTIVE SUMMARY

**Current State:** UI components built, backend NOT wired
**Production Readiness:** ~25% complete
**Critical Gaps:** 15 major violations of SYSTEM_LAW

---

## CRITICAL SYSTEM_LAW VIOLATIONS

### LAW-AUT-004: Evidence/Receipts Queryability ❌

**Requirement:**
```
The system must support querying receipts to decide next actions deterministically.
- GET /receipts/query?run_id=&wih_id=&type= (paged)
- Query by receipt kind
- Query by correlation_id (trace across events)
```

**Current State:**
- ❌ ReceiptsView has empty mock data `[]`
- ❌ No receipt generation on action completion
- ❌ No receipt storage
- ❌ No receipt query API
- ❌ No correlation_id tracking

**What's Needed:**
1. Receipt generation service
2. Receipt storage (database)
3. Receipt query API
4. Correlation ID tracking across events

---

### LAW-ENF-002: Auditability ❌

**Requirement:**
```
All actions must be:
- Attributable
- Reproducible
- Explainable

If it cannot be audited, it cannot run.
```

**Current State:**
- ❌ BrowserAgentBar actions not logged
- ❌ No attribution (who/what triggered action)
- ❌ No reproducibility (no action replay)
- ❌ No explainability (no action rationale)

**What's Needed:**
1. Action logging service
2. Attribution tracking (user/agent/session)
3. Action replay capability
4. Action rationale capture

---

### LAW-ENF-006: Observability Legibility Contract ❌

**Requirement:**
```
Agents must be able to inspect runtime state deterministically.

Required Surfaces:
1. Structured logs (queryable via LogQL-like interface)
2. Metrics (queryable via PromQL-like interface)
3. Traces (span per major action)
4. UI state (DOM snapshot, screenshot capability)
5. Performance stats (response time, error rate)
```

**Current State:**
- ❌ No structured logging
- ❌ No metrics collection
- ❌ No trace spans
- ⚠️ UI state partially captured (BrowserAgentOverlay)
- ❌ No performance stats

**What's Needed:**
1. Structured logging service
2. Metrics collection (Prometheus-compatible)
3. Distributed tracing (OpenTelemetry-compatible)
4. UI state capture service
5. Performance monitoring

---

### LAW-ENF-007: Canonical Event Schema Law ❌

**Requirement:**
```
All events must follow canonical schema:

event_id: "evt_<uuid>"
timestamp: "<ISO-8601>"
correlation_id: "<corr_uuid>"
session_id: "<session_uuid>"
event_type: "<namespace.event_name>"
severity: "info|warn|error|critical"
source: "<component_id>"
payload: "<structured_data>"
context:
  prefix_hash: "<hash>"
  toolset_hash: "<hash>"
  workspace_hash: "<hash>"
```

**Current State:**
- ❌ BrowserAgentEvent types don't match canonical schema
- ❌ No correlation_id
- ❌ No session_id tracking
- ❌ No context hashes

**What's Needed:**
1. Event schema alignment
2. Correlation ID generation
3. Session tracking
4. Context hash computation

---

### LAW-SWM-005: Evidence-First Outputs ❌

**Requirement:**
```
All swarm outputs must include:
- Receipts (tool calls, commands, stdout/stderr)
- Hashes: envHash, policyHash, inputsHash, codeHash
- Artifact manifests with integrity hashes
```

**Current State:**
- ❌ No receipt generation
- ❌ No hash computation
- ❌ No artifact manifests

**What's Needed:**
1. Receipt generation on every action
2. Hash computation service
3. Artifact manifest generation

---

### LAW-TOOL-002: Capability-Based Policy Binding ❌

**Requirement:**
```
Policy enforcement must be bound to tool capability class.

| Capability   | PreToolUse Gate      | Approval Required          | Receipt Required |
|--------------|----------------------|----------------------------|------------------|
| Read         | Schema validation    | No                         | Yes              |
| Write        | Schema + path valid  | Risk tier ≥3               | Yes              |
| Execute      | Full policy check    | Risk tier ≥2               | Yes              |
| Destructive  | Security review      | Always (human for tier 4)  | Yes              |
| External     | Allowlist check      | Risk tier ≥2               | Yes              |
```

**Current State:**
- ❌ PolicySection UI doesn't enforce anything
- ❌ No PreToolUse gates
- ❌ No approval workflow
- ❌ No capability classification

**What's Needed:**
1. Policy engine integration
2. PreToolUse gate implementation
3. Approval workflow
4. Tool capability classification

---

### LAW-OPS-003: Retry Semantics Law ⚠️

**Requirement:**
```
Retry behavior must be explicit and bounded.
- Max retries per operation type
- Exponential backoff with jitter
- Retry budget per session (max 10 retries)
- Circuit breaker after 5 consecutive failures
```

**Current State:**
- ⚠️ BrowserAgentEvent types have retry field but no implementation
- ❌ No retry budget tracking
- ❌ No circuit breaker integration

**What's Needed:**
1. Retry service implementation
2. Budget tracking
3. Circuit breaker integration

---

## PRODUCTION READINESS CHECKLIST

### Phase 1: Receipt Generation (CRITICAL)

- [ ] Create receipt schema aligned with Receipts.json
- [ ] Implement receipt generation service
- [ ] Add receipt storage (SQLite/Postgres)
- [ ] Create receipt query API
- [ ] Add correlation_id tracking
- [ ] Wire ReceiptsView to actual receipt stream

**Estimated:** 8-10 hours

---

### Phase 2: Event Schema Alignment (CRITICAL)

- [ ] Align BrowserAgentEvent with canonical event schema
- [ ] Add correlation_id generation
- [ ] Add session_id tracking
- [ ] Add context hash computation
- [ ] Wire to observability service

**Estimated:** 6-8 hours

---

### Phase 3: Policy Enforcement (CRITICAL)

- [ ] Implement policy engine integration
- [ ] Add PreToolUse gates
- [ ] Implement approval workflow
- [ ] Add tool capability classification
- [ ] Wire host allowlist to actual enforcement

**Estimated:** 10-12 hours

---

### Phase 4: Observability (HIGH)

- [ ] Implement structured logging
- [ ] Add metrics collection
- [ ] Add distributed tracing
- [ ] Add performance monitoring
- [ ] Wire BrowserAgentBar to observability

**Estimated:** 8-10 hours

---

### Phase 5: Backend Wiring (HIGH)

- [ ] Wire BrowserAgentBar to browser runtime
- [ ] Wire BrowserAgentOverlay to action events
- [ ] Wire EnvironmentSelector to 8-cloud registry
- [ ] Wire ControlCenter to backend services
- [ ] Wire Agentation to actual functionality

**Estimated:** 12-15 hours

---

### Phase 6: Audit Trail (MEDIUM)

- [ ] Implement action logging
- [ ] Add attribution tracking
- [ ] Add action replay capability
- [ ] Add action rationale capture

**Estimated:** 6-8 hours

---

## TOTAL ESTIMATED EFFORT

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Receipt Generation | 8-10h | CRITICAL |
| Phase 2: Event Schema | 6-8h | CRITICAL |
| Phase 3: Policy Enforcement | 10-12h | CRITICAL |
| Phase 4: Observability | 8-10h | HIGH |
| Phase 5: Backend Wiring | 12-15h | HIGH |
| Phase 6: Audit Trail | 6-8h | MEDIUM |
| **TOTAL** | **50-63 hours** | |

---

## RECOMMENDED ORDER

1. **Phase 1: Receipt Generation** - Foundation for auditability
2. **Phase 2: Event Schema** - Required for all events
3. **Phase 5: Backend Wiring** - Makes UI functional
4. **Phase 3: Policy Enforcement** - Required for production
5. **Phase 4: Observability** - Required for LAW-ENF-006
6. **Phase 6: Audit Trail** - Required for LAW-ENF-002

---

## SYSTEM_LAW COMPLIANCE STATUS

| LAW | Status | Notes |
|-----|--------|-------|
| LAW-AUT-004 (Receipts Queryability) | ❌ | No receipt generation/storage |
| LAW-ENF-002 (Auditability) | ❌ | No action logging |
| LAW-ENF-006 (Observability) | ❌ | No structured logs/metrics/traces |
| LAW-ENF-007 (Event Schema) | ❌ | Schema doesn't match canonical |
| LAW-SWM-005 (Evidence-First) | ❌ | No receipts/hashes/artifacts |
| LAW-TOOL-002 (Policy Binding) | ❌ | No policy enforcement |
| LAW-OPS-003 (Retry Semantics) | ⚠️ | Partial (types exist, no impl) |

**Overall Compliance: ~10%**

---

**End of Gap Analysis**
