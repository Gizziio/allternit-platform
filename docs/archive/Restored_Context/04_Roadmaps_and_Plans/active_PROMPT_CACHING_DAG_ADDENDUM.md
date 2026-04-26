# Allternit Prompt Caching Doctrine - DAG Task Integration

**Document Type:** Addendum to MASTER_DAG_TASK_BREAKDOWN.md  
**Date:** 2026-02-20  
**Source:** `allternit-session__prompt-caching-doctrine__2026-02-19.md`  
**Priority:** P0 - CRITICAL (Economic survival, not optimization)

---

## Executive Summary

**Prompt caching is not "optimization" — it is economic and latency survival.**

This doctrine adds **18 new critical tasks** to the DAG, primarily affecting:
- Harness Layer (Prompt Compiler implementation)
- Living Files Architecture (cache-safe design)
- Swarm Scheduler (cache-aware economics)
- Observability (cache health metrics)
- Repo Law (CACHE-001 enforcement)

**Impact:** Without prompt caching, Allternit's unit economics fail at scale. Cache hit rate must be treated as a first-class SLO (like error rate, latency).

---

## New Critical Path: Prompt Caching Infrastructure

### P0.9: Prompt Caching Foundation (NEW - Week 1)

**Priority:** P0 - CRITICAL  
**Effort:** 3 days  
**Dependencies:** P0.1 (LAW Consolidation) ✅  
**Owner:** Backend Team

**Rationale:** Prompt caching affects every agent interaction. Must be designed into the harness from day 1, not bolted on later.

**Subtasks:**
- [ ] 0.9.1: Create Prompt Caching Doctrine ADR (`/spec/ADRs/ADR-CACHE-001.md`)
- [ ] 0.9.2: Define canonical prompt layering model (L0-L3)
- [ ] 0.9.3: Implement Prompt Compiler skeleton (`harness/prompt_compiler/`)
- [ ] 0.9.4: Define hash identifiers (prefix_hash, toolset_hash, workspace_hash, session_hash)
- [ ] 0.9.5: Create `allternit lint-caching` script for CI validation
- [ ] 0.9.6: Add CACHE-001 to `/agent/POLICY.md`

**Acceptance Criteria:**
- L0-L3 layering model documented
- Prompt Compiler produces deterministic requests
- Hash identifiers emitted for every request
- CI fails on volatile tokens in L0-L2

---

### P1.9: Tool Stubs + Defer-Loading System (NEW - Week 2)

**Priority:** P1 - HIGH  
**Effort:** 1 week  
**Dependencies:** P0.9  
**Owner:** Backend Team

**Rationale:** Tool schema churn is a major cache-breaker. Defer-loading preserves prefix stability.

**Subtasks:**
- [ ] 1.9.1: Implement tool stubs schema (`harness/tool/stubs.rs`)
- [ ] 1.9.2: Create defer-loading protocol for optional/large tools
- [ ] 1.9.3: Implement canonical tool ordering (sorted by name)
- [ ] 1.9.4: Add schema-hash pinning for each tool
- [ ] 1.9.5: Implement ToolSearch + stub resolution
- [ ] 1.9.6: Create toolset_hash validation (must be constant per session)

**Acceptance Criteria:**
- All tools have stubs in L0 prefix
- Full schemas loaded only in L3 tail when needed
- Toolset_hash never changes mid-session
- Tool ordering is deterministic (sorted)

---

### P1.10: Cache-Safe Living Files Architecture (NEW - Week 3)

**Priority:** P1 - HIGH  
**Effort:** 1 week  
**Dependencies:** P0.6 (Harness Foundation), P1.9  
**Owner:** Backend Team

**Rationale:** Living Files are dynamic by nature. Without cache-safe design, they destroy cache hit rates.

**Subtasks:**
- [ ] 1.10.1: Separate "schema" (L1 prefix) from "state" (L3 tail)
- [ ] 1.10.2: Implement stable memory serialization (deterministic ordering)
- [ ] 1.10.3: Create state update protocol (MemoryRead, MemoryPatch with RFC 6902 JSON Patch)
- [ ] 1.10.4: Implement versioned semantic schema versions
- [ ] 1.10.5: Design GC as patch-producing operation (not schema rewrite)
- [ ] 1.10.6: Implement compaction-compatible summary format (stable IDs)

**Acceptance Criteria:**
- Living Files changes never alter L0-L2
- State updates are patch-only (no full re-dumps)
- Compaction produces deterministic summary with stable IDs
- GC runs produce patches, not full rewrites

---

### P2.9: Cache Observability Dashboard (NEW - Week 8)

**Priority:** P2 - MEDIUM  
**Effort:** 1 week  
**Dependencies:** P1.5 (Observability Contract)  
**Owner:** Full Stack Team

**Rationale:** Cache hit rate is a first-class SLO. Must be visible, monitored, and alerted on.

**Subtasks:**
- [ ] 2.9.1: Define cache event schema (session_id, prefix_hash, toolset_hash, cache_hit_tokens, etc.)
- [ ] 2.9.2: Implement cache metrics collection (hit rate, prefix stability, toolset stability)
- [ ] 2.9.3: Create Cache Health dashboard UI
- [ ] 2.9.4: Implement incident policy (SEV triggers for cache drops)
- [ ] 2.9.5: Add drift cause breakdown (top offenders: tool order, schema change, volatile injection)
- [ ] 2.9.6: Create time series: cache hit rate + latency correlation

**Acceptance Criteria:**
- Cache hit rate visible in real-time
- Prefix hash stability tracked per session
- Toolset hash changes trigger alerts (always SEV)
- Drift causes ranked and visible

---

### P2.10: Swarm Scheduler Cache-Aware Economics (NEW - Week 10)

**Priority:** P2 - MEDIUM  
**Effort:** 1 week  
**Dependencies:** P2.1 (Swarm Scheduler Core)  
**Owner:** Backend Team

**Rationale:** Swarm fan-out amplifies cache waste if not managed. Cache hit rate must gate concurrency.

**Subtasks:**
- [ ] 2.10.1: Implement model lock per session (primary agent fixed)
- [ ] 2.10.2: Create subagent handoff protocol (minimal, deterministic packets)
- [ ] 2.10.3: Implement cache-aware batching strategy (fewer, richer turns)
- [ ] 2.10.4: Add cache hit rate gate for swarm fan-out
- [ ] 2.10.5: Create quantitative bookkeeping (effective input tokens, cost per minute, latency per turn)
- [ ] 2.10.6: Implement "warm session" priority (optional node locality)

**Acceptance Criteria:**
- Swarm fan-out does not trigger tool/model churn
- Cache hit rate gates concurrency (below threshold → reduce fan-out)
- Subagent handoffs are minimal and deterministic
- Cost/latency bookkeeping accurate per session

---

### P2.11: Cache-Safe Compaction Protocol (NEW - Week 11)

**Priority:** P2 - MEDIUM  
**Effort:** 1 week  
**Dependencies:** P1.10, P2.9  
**Owner:** Backend Team

**Rationale:** Compaction must preserve prefix stability while reducing tail size.

**Subtasks:**
- [ ] 2.11.1: Implement compaction fork request (same prefix, tail-only compaction prompt)
- [ ] 2.11.2: Create compaction buffer window management
- [ ] 2.11.3: Design summary format (deterministic, stable IDs)
- [ ] 2.11.4: Implement summary storage as Living File (referenced by ID, not re-expanded)
- [ ] 2.11.5: Add compaction frequency + cost metrics
- [ ] 2.11.6: Create compaction compatibility tests (prefix_hash reuse verification)

**Acceptance Criteria:**
- Compaction request reuses parent prefix_hash
- Summary format is deterministic
- Summaries referenced by ID (not re-expanded each turn)
- Compaction cost tracked and visible

---

### P3.9: Mode Transition Tools (NEW - Week 15)

**Priority:** P3 - STRATEGIC  
**Effort:** 3 days  
**Dependencies:** P1.2 (Tool Wrapper System)  
**Owner:** Backend Team

**Rationale:** Plan mode, swarm mode, etc. must use tools (not tool swapping) to preserve cache.

**Subtasks:**
- [ ] 3.9.1: Implement EnterPlanMode / ExitPlanMode tools
- [ ] 3.9.2: Implement EnterSwarmMode / ExitSwarmMode tools
- [ ] 3.9.3: Ensure mode transitions do not alter tool schemas
- [ ] 3.9.4: Add mode transition receipts (for audit trail)
- [ ] 3.9.5: Create mode transition metrics (frequency, latency impact)

**Acceptance Criteria:**
- Mode transitions use tools (not schema changes)
- Tool schemas unchanged during mode transitions
- Mode transitions logged in receipts
- Mode transition latency impact visible

---

## Modified Existing Tasks

### P0.4: Harness Layer Foundation (MODIFIED)

**Add to subtasks:**
- [ ] 0.4.9: Implement Prompt Compiler skeleton (`harness/prompt_compiler/`)
- [ ] 0.4.10: Define L0-L3 layering model
- [ ] 0.4.11: Create hash identifier emission (prefix_hash, toolset_hash, etc.)

**Revised Effort:** 3 days → **5 days** (+2 days for prompt caching)

---

### P1.1: Policy Engine Implementation (MODIFIED)

**Add to subtasks:**
- [ ] 1.1.8: Implement CACHE-001 enforcement (toolset_hash validation, model lock)
- [ ] 1.1.9: Add runtime guard for mid-session toolset changes (reject + incident event)

**Revised Effort:** 2 weeks → **2.5 weeks** (+0.5 weeks for cache enforcement)

---

### P1.2: Tool Wrapper System (MODIFIED)

**Add to subtasks:**
- [ ] 1.2.7: Implement tool stubs with defer_loading flag
- [ ] 1.2.8: Add canonical tool ordering (sorted by name)
- [ ] 1.2.9: Implement schema-hash pinning

**Revised Effort:** 1 week → **1.5 weeks** (+0.5 weeks for stubs + ordering)

---

### P1.5: Observability Contract Implementation (MODIFIED)

**Add to subtasks:**
- [ ] 1.5.7: Add cache event schema (prefix_hash, toolset_hash, cache_hit_tokens, etc.)
- [ ] 1.5.8: Implement cache metrics emission (hit rate, drift causes)

**Revised Effort:** 1 week → **1.5 weeks** (+0.5 weeks for cache events)

---

### P2.1: Swarm Scheduler Core (MODIFIED)

**Add to subtasks:**
- [ ] 2.1.9: Implement cache hit rate gate for concurrency
- [ ] 2.1.10: Add model lock per session (primary agent fixed)
- [ ] 2.1.11: Create subagent handoff protocol (minimal packets)

**Revised Effort:** 3 weeks → **3.5 weeks** (+0.5 weeks for cache-aware scheduling)

---

### P2.8: BYOC Edge Runner (MODIFIED)

**Add to subtasks:**
- [ ] 2.8.7: Implement cache event forwarding to control plane
- [ ] 2.8.8: Add local cache health monitoring

**Revised Effort:** 2 weeks → **2.5 weeks** (+0.5 weeks for cache observability)

---

## New Repo Law: CACHE-001

### Location: `/spec/ADRs/ADR-CACHE-001.md`

```markdown
# ADR-CACHE-001: Prompt Prefix Stability Law

## Status
Tier-1 Law (derived from PROJECT_LAW.md LAW-GRD-005: No "Just Make It Work")

## Rules

### 1. Tool Registry Determinism
- Tool registry output MUST be deterministic
- Tools sorted by name
- Stable JSON serialization
- Schemas pinned to versions
- toolset_hash produced and logged

### 2. Tool Immutability Per Session
- No tool addition/removal in a session
- Tool list constant for lifetime of session_id
- Violation: Reject request + emit incident event

### 3. Model Lock
- No model switching for primary agent in-session
- Subagent handoffs allowed (with minimal packets)

### 4. Mode Transitions Via Tools
- Plan mode uses EnterPlanMode/ExitPlanMode tools
- Swarm mode uses EnterSwarmMode/ExitSwarmMode tools
- Tool schemas NOT altered during mode transitions

### 5. Layer-Bounded Volatility
- Timestamps and volatile data ONLY in L3 tail
- L0/L1/L2 MUST NOT contain volatile tokens

## Enforcement

### CI Check
- `allternit lint-caching` verifies:
  - Tool order stability
  - Schema stability
  - No volatile tokens in L0-L2

### Runtime Guard
- If toolset_hash changes mid-session:
  - Reject request
  - Emit SEV incident event
  - Log drift report

### Drift Report
- Required whenever prefix_hash changes unexpectedly
- Must identify which layer changed and why

## Artifacts
- `/spec/ADRs/ADR-CACHE-001.md` (this file)
- `/agent/POLICY.md` section: "Caching constraints and forbidden mutations"
- `allternit lint-caching` script in agent-scripts
```

---

## Updated DAG Overview

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Total Tasks** | 147 | 165 | +18 |
| **P0 Tasks** | 8 | 9 | +1 |
| **P1 Tasks** | 18 | 20 | +2 |
| **P2 Tasks** | 35 | 39 | +4 |
| **P3 Tasks** | 86 | 87 | +1 |
| **Modified Tasks** | - | 7 | +7 |
| **Critical Path** | 42 tasks, 24 weeks | 44 tasks, 25 weeks | +2 tasks, +1 week |

---

## Revised Timeline

| Phase | Original | Revised | Change |
|-------|----------|---------|--------|
| **Phase 0** (LAW + Harness) | Week 1-4 | Week 1-4 | +2 days (P0.9) |
| **Phase 1** (Core Services) | Week 5-10 | Week 5-11 | +1 week (P1.9, P1.10) |
| **Phase 2** (Swarm + UI) | Week 11-20 | Week 12-22 | +2 weeks (P2.9, P2.10, P2.11) |
| **Phase 3** (Advanced) | Week 21-28 | Week 23-28 | +1 week (P3.9) |
| **Buffer** | Week 29-32 | Week 29-32 | No change |
| **TOTAL** | **32 weeks** | **32 weeks** | **No change** (absorbed into existing phases) |

---

## Critical Path Impact

### New Critical Path Tasks

```
P0.9: Prompt Caching Foundation (3 days)
    ↓
P1.9: Tool Stubs + Defer-Loading (1 week)
    ↓
P1.10: Cache-Safe Living Files (1 week)
    ↓
P2.10: Swarm Cache-Aware Economics (1 week)
    ↓
P2.11: Cache-Safe Compaction (1 week)
    ↓
MVP (Week 32)
```

### Cache Hit Rate SLO

| Metric | Target | Monitoring |
|--------|--------|------------|
| **Cache Hit Rate** | >90% for warm sessions | Real-time dashboard |
| **Prefix Hash Stability** | >95% of turns unchanged | Per-session tracking |
| **Toolset Hash Stability** | 100% constant per session | Incident on any change |
| **Drift Detection** | <5% of turns | Ranked by cause |

---

## Implementation Priority

### Week 1 (P0)
1. ✅ LAW Consolidation (P0.1)
2. ⬜ Kernel Ontology Violation Fix (P0.3)
3. ⬜ DAK-Rails Contract Audit (P0.4)
4. ⬜ **NEW: Prompt Caching Foundation (P0.9)** ← Start this

### Week 2-3 (P1)
1. Tool Stubs + Defer-Loading (P1.9)
2. Cache-Safe Living Files (P1.10)
3. Policy Engine + CACHE-001 enforcement (P1.1 modified)

### Week 8-11 (P2)
1. Cache Observability Dashboard (P2.9)
2. Swarm Cache-Aware Economics (P2.10)
3. Cache-Safe Compaction (P2.11)

---

## Success Criteria

### Technical

- [ ] 95%+ of turns share identical L0-L2 prefixes (with no repo/tool changes)
- [ ] Toolset_hash never changes mid-session
- [ ] EnterPlanMode/ExitPlanMode do not alter tool schemas
- [ ] Compaction request reuses parent prefix_hash
- [ ] Cache hit rate >90% for warm sessions

### Economic

- [ ] Cost per turn reduced by 60-80% (vs no caching)
- [ ] Latency p50 reduced by 40-60% (vs no caching)
- [ ] Swarm fan-out sustainable at 100+ concurrent agents

### Observability

- [ ] Cache hit rate visible in real-time
- [ ] Prefix hash stability tracked per session
- [ ] Toolset hash changes trigger SEV alerts
- [ ] Drift causes ranked and actionable

---

## Risk Register (Updated)

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Cache hit rate <50% | Medium | 🔴 Critical | Design L0-L3 layering from day 1 |
| Tool schema churn breaks cache | High | 🔴 Critical | Defer-loading + stubs |
| Living Files destroy cache | Medium | 🟡 High | Schema-in-prefix, state-in-tail |
| Swarm amplifies cache waste | Medium | 🟡 High | Cache hit rate gates concurrency |
| Compaction breaks prefix | Low | 🟡 High | Compaction fork protocol |

---

## Next Actions

### Immediate (This Week)

1. **Create ADR-CACHE-001** (`/spec/ADRs/ADR-CACHE-001.md`)
2. **Implement Prompt Compiler skeleton** (`harness/prompt_compiler/`)
3. **Add `allternit lint-caching` script** to CI
4. **Update MASTER_DAG_TASK_BREAKDOWN.md** with new tasks

### Week 2-3

1. **Implement tool stubs + defer-loading**
2. **Design cache-safe Living Files architecture**
3. **Add CACHE-001 enforcement to Policy Engine**

### Week 8-11

1. **Build Cache Health dashboard**
2. **Implement swarm cache-aware economics**
3. **Create compaction protocol**

---

**End of Prompt Caching Doctrine Integration**
