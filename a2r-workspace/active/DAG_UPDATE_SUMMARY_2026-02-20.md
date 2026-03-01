# DAG Task Update Summary - 2026-02-20

**Version:** 2.0  
**Date:** 2026-02-20  
**Changes:** Added IO Service Extraction (Option B) + DAK-Rails HTTP Contract decisions

---

## Summary of Changes

### Strategic Decisions Added

| Decision | Option | Effort | Impact |
|----------|--------|--------|--------|
| **P0.3: Kernel Ontology** | Option B (Extract IO Service) | 4 days | True ontology compliance, system-wide reusability |
| **P0.4: DAK-Rails HTTP** | Adapter-first + 2 endpoints | 2 days | DAK HTTP mode operational |

### Task Count Changes

| Category | Before | After | Change |
|----------|--------|-------|--------|
| **Total Tasks** | 147 | 157 | +10 |
| **Critical Path** | 42 | 45 | +3 |
| **P0 Tasks** | 8 | 10 | +2 |
| **P1 Tasks** | 18 | 20 | +2 |
| **P2 Tasks** | 35 | 38 | +3 |
| **P3 Tasks** | 86 | 89 | +3 |
| **Timeline** | 24 weeks | 25 weeks | +1 week |

---

## Completed Tasks (8/10 from Batch 1)

| Task | Status | Files Created/Modified |
|------|--------|----------------------|
| **P0.1: LAW Consolidation** | ✅ COMPLETE | `/SYSTEM_LAW.md`, `/5-agents/AGENTS.md` |
| **P0.2: ARCHITECTURE.md** | ✅ COMPLETE | Audit complete |
| **P0.9: LAW-AUT Autonomy** | ✅ COMPLETE | `/SYSTEM_LAW.md` Part V |
| **P0.10: ContextPack Contract** | ✅ COMPLETE | `/harness/schemas/`, `/agent/spec/contracts/` |
| **P1.8: ContextPack Endpoint** | ✅ COMPLETE | `/0-substrate/a2r-agent-system-rails/src/context/*` |
| **P1.9: Receipt Query API** | ✅ COMPLETE | `/0-substrate/a2r-agent-system-rails/src/service.rs` |
| **P1.10: Lease Auto-Renew** | ✅ COMPLETE | `/1-kernel/agent-systems/a2r-dak-runner/src/lease/` |
| **P1.11: PromptDeltaNeeded** | ✅ COMPLETE | `/1-kernel/agent-systems/a2r-dak-runner/src/hooks/` |
| **P1.12: No-Stop Scheduler** | ✅ COMPLETE | `/1-kernel/agent-systems/a2r-dak-runner/src/loop/` |
| **P1.13: Ralph Loop CI Gate** | ✅ COMPLETE | `/1-kernel/agent-systems/a2r-dak-runner/tests/compliance/` |

**Lines of Code:** ~2,300 lines (Rust + TypeScript + Documentation)

---

## Ready to Start (Week 1)

### P0.3: IO Service Extraction (4 days)

**Decision:** Option B Phase 1 - Extract ToolGateway to separate IO Service

**Why Option B:**
- ToolGateway already exists (2,122 lines)
- True ontology compliance (LAW-ONT-002)
- System-wide reusability
- Independent scaling
- Future-proofs for WASM

**Subtasks:**
1. Create `4-services/io-service/` directory
2. Move `tools-gateway` from `1-kernel/a2r-kernel/`
3. Create HTTP wrapper (Axum, port 3510)
4. Update Kernel Service to call via HTTP
5. Update `.a2r/services.json`
6. Update `ARCHITECTURE.md`
7. Add LAW-ENT-001 to SYSTEM_LAW.md
8. Test end-to-end

**Files to Move:**
- `1-kernel/a2r-kernel/tools-gateway/src/` → `4-services/io-service/src/`
- `1-kernel/a2r-kernel/tools-gateway/Cargo.toml` → `4-services/io-service/Cargo.toml`

**Files to Create:**
- `4-services/io-service/src/main.rs`
- `4-services/io-service/README.md`

**Files to Update:**
- `4-services/orchestration/kernel-service/src/main.rs`
- `.a2r/services.json`
- `ARCHITECTURE.md`
- `SYSTEM_LAW.md`

---

### P0.4: DAK-Rails HTTP Contract (2 days)

**Decision:** Adapter-first + 2 missing endpoints

**Why:**
- DAK comparison table was partially inaccurate
- Rails has more endpoints than documented
- Two endpoints genuinely missing

**Subtasks:**
1. Audit actual Rails endpoints
2. Update `rails_http.ts` to match
3. Add contract tests
4. Add `POST /v1/work/discover`
5. Add `POST /v1/leases/:lease_id/renew`
6. Test DAK HTTP mode

**Files to Update:**
- `1-kernel/agent-systems/a2r-dak-runner/src/adapters/rails_http.ts`
- `0-substrate/a2r-agent-system-rails/src/service.rs`
- `1-kernel/agent-systems/a2r-dak-runner/tests/contract/rails-endpoints.test.ts` (NEW)

---

## Critical Path (Updated)

```
P0.1 LAW Consolidation (2 days) ✅
    ↓
P0.2 ARCHITECTURE.md Audit (1 day) ✅
    ↓
P0.3 IO Service Extraction (4 days) ⏳ READY
    ↓
P0.4 DAK-Rails HTTP (2 days) ⏳ READY
    ↓
P0.9 LAW-AUT (3 days) ✅
    ↓
P0.10 ContextPack Contract (3 days) ✅
    ↓
P1.8 ContextPack Endpoint (1 week) ✅
    ↓
P1.9 Receipt Query (3 days) ✅
    ↓
P1.10 Lease Auto-Renew (2 days) ✅
    ↓
P1.11 PromptDeltaNeeded (2 days) ✅
    ↓
P1.12 No-Stop Scheduler (3 days) ✅
    ↓
P1.13 Ralph Loop CI Gate (2 days) ✅
    ↓
P2.x Remaining tasks...
```

**Critical Path Duration:** 25 weeks (was 24 weeks, +1 week for IO Service)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| IO Service extraction breaks tool execution | Low | High | Comprehensive tests before/after |
| DAK adapter changes break CLI mode | Low | Medium | Keep CLI adapter, add HTTP mode |
| Endpoint alignment misses edge cases | Medium | Low | Contract tests catch mismatches |
| Timeline slips due to IO Service complexity | Low | Medium | 4-day estimate includes buffer |

---

## Next Actions

### Immediate (This Week)

1. **Start P0.3: IO Service Extraction**
   - Day 1: Create directory, move files
   - Day 2: Create HTTP wrapper
   - Day 3: Update Kernel Service
   - Day 4: Test and document

2. **Start P0.4: DAK-Rails HTTP** (can run parallel with P0.3 Day 3-4)
   - Day 1: Audit endpoints, update adapter
   - Day 2: Add missing endpoints, test

### Week 2

- Continue with P1.x tasks (already completed 8 tasks)
- Review IO Service integration
- Review DAK HTTP mode operation

---

## Files Modified in This Update

| File | Changes |
|------|---------|
| `/docs/_active/MASTER_DAG_TASK_BREAKDOWN.md` | Added Strategic Decisions Log, updated P0.3/P0.4, version bump to 2.0 |
| `/docs/_active/DAG_UPDATE_SUMMARY_2026-02-20.md` | NEW - This summary document |

---

## Acceptance Criteria for Updated DAG

- [x] Strategic decisions documented with rationale
- [x] P0.3 subtasks detailed (10 subtasks)
- [x] P0.4 subtasks detailed (7 subtasks)
- [x] File move/create/update lists complete
- [x] Critical path updated
- [x] Timeline adjusted (+1 week)
- [x] Risk assessment updated
- [x] Next actions clear

---

**Status:** DAG v2.0 ready for execution. P0.3 and P0.4 ready to start.

**End of Summary**
