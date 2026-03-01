# A2R MASTER DAG TASK BREAKDOWN 2026 - UPDATED
## Complete Buildout Implementation Plan (Post-Audit)

**Document Type:** Executable DAG Specification  
**Date:** 2026-02-20  
**Version:** 3.0 (Post-Brainstorm Audit + P3.19/P3.20 Complete)  
**Status:** P0-P2 100% Complete, P3 In Progress  

---

## Executive Summary

**Completed (P0-P2):**
- P0: 10/10 tasks ✅ (1 week actual)
- P1: 13/13 tasks ✅ (2 days actual)
- P2: 13/13 tasks ✅ (3 weeks actual)

**In Progress (P3):**
- P3.19: SYSTEM_LAW Layer ✅ COMPLETE (1,150 lines, 10 tests)
- P3.20: Harness Engineering ✅ COMPLETE (1,050 lines, 8 tests)
- P3.6-P3.18, P3.21-P3.25: Remaining 17 tasks (~49 weeks)

**Pending (P4):**
- P4.1-P4.15: 15 tasks (~40 weeks)

**Total Revised Scope:** 66 tasks (36 complete, 30 remaining)  
**Total Revised Duration:** ~94 weeks to full completion (~22 months)  
**Critical Path to MVP:** 28 weeks (~7 months)

---

## Completed Work Summary

### P0 Phase: LAW Consolidation & Architecture Truth (1 week) ✅

| Task | Status | Deliverables |
|------|--------|--------------|
| P0.1: LAW Document Consolidation | ✅ | PROJECT_LAW.md → SYSTEM_LAW.md |
| P0.2: ARCHITECTURE.md Truth-Telling | ✅ | Service audit, port registry |
| P0.3: IO Service Extraction | ✅ | 4-services/io-service/ (port 3510) |
| P0.4: DAK-Rails HTTP Contract Alignment | ✅ | 4 endpoints, contract tests |

### P1 Phase: Verification & Documentation (2 days) ✅

| Task | Status | Finding |
|------|--------|---------|
| P1.1: Policy Engine | ✅ | EXISTS - verified (734 lines) |
| P1.2: Tool Wrapper | ✅ | EXISTS - verified (ToolGateway 2,122 lines) |
| P1.3: Context Pack Builder | ✅ | EXISTS - verified |
| P1.4: Review Protocol | ✅ | EXTRACTED to spec/review-protocol.md |

### P2 Phase: Enhancement & New Capabilities (3 weeks) ✅

| Task | Type | Deliverables |
|------|------|--------------|
| P2.1: Scheduler Enhancement | Enhancement | ~310 lines |
| P2.2: WorkerManager Enhancement | Enhancement | ~200 lines |
| P2.3: Lease Auto-Renewal | Enhancement | ~120 lines |
| P2.4: Receipt Enhancement | Enhancement | ~180 lines, 3 endpoints |
| P2.5: Conflict Arbitration | NEW BUILD | 531 lines, 5 tests |
| P2.6: Budget Metering | NEW BUILD | 559 lines, 6 tests |
| P2.7: Event Bus Schema | Enhancement | ~240 lines |
| P2.6: Node Registry | NEW BUILD | 595 lines, 4 tests |
| P2.8: BYOC Edge Runner | NEW BUILD | 650+ lines |

### P3 Phase: Critical Foundation (In Progress)

| Task | Status | Deliverables |
|------|--------|--------------|
| **P3.19: SYSTEM_LAW Layer** | ✅ **COMPLETE** | **1,150 lines, 10 tests** |
| **P3.20: Harness Engineering** | ✅ **COMPLETE** | **1,050 lines, 8 tests** |
| P3.6: Playground Core Engine | ⏳ PENDING | - |
| P3.7: Foundational Playground Templates | ⏳ PENDING | - |
| P3.8: UX Playground Templates | ⏳ PENDING | - |
| P3.9: MCP Apps Integration | ⏳ PENDING | - |
| P3.10: Chrome Extension / Browser Capsule | ⏳ PENDING | - |
| P3.11: Avatar Engine / AVSP | ⏳ PENDING | - |
| P3.12: Browser-use / Operator Browser Tool | ⏳ PENDING | - |
| P3.13: JSON Render / UGI Integration | ⏳ PENDING | - |
| P3.14: Form Surfaces | ⏳ PENDING | - |
| P3.15: Agent Characterization Framework | ⏳ PENDING | - |
| P3.16: Content Ingestion Kernel | ⏳ PENDING | - |
| P3.17: Session/Context Management | ⏳ PENDING | - |
| P3.18: Ars Contexta Knowledge System | ⏳ PENDING | - |
| P3.21: Capsule System | ⏳ PENDING | - |
| P3.22: Canvas Protocol | ⏳ PENDING | - |
| P3.23: Hooks System | ⏳ PENDING | - |
| P3.24: Environment Standardization | ⏳ PENDING | - |
| P3.25: Vendor Wrappers | ⏳ PENDING | - |

### P4 Phase: Advanced Features (Pending)

| Task | Status | Effort |
|------|--------|--------|
| P4.1: Swarm Scheduler Advanced | ⏳ PENDING | 2 weeks |
| P4.2: Agent Communication Layer | ⏳ PENDING | 2 weeks |
| P4.3: Advanced Conflict Resolution | ⏳ PENDING | 2 weeks |
| P4.4: Budget Optimization | ⏳ PENDING | 2 weeks |
| P4.5: Node Auto-Scaling | ⏳ PENDING | 2 weeks |
| P4.6: Multi-Region Deployment | ⏳ PENDING | 3 weeks |
| P4.7: Evolution Layer | ⏳ PENDING | 6 weeks |
| P4.8: Context Control Plane | ⏳ PENDING | 4 weeks |
| P4.9: Multimodal Streaming | ⏳ PENDING | 3 weeks |
| P4.10: Memory Kernel | ⏳ PENDING | 4 weeks |
| P4.11: Tambo Integration | ⏳ PENDING | 2 weeks |
| P4.12: Autonomous Code Factory | ⏳ PENDING | 3 weeks |
| P4.13: Garbage Collection Agents | ⏳ PENDING | 2 weeks |
| P4.14: Quality Score System | ⏳ PENDING | 1 week |
| P4.15: Legacy Spec Audit | ⏳ PENDING | 1 week |

---

## Critical Path to MVP (28 weeks)

### Phase 1: Critical Foundation (10 weeks) ✅ 2 weeks complete

- [x] **P3.19: SYSTEM_LAW Layer** (6 weeks) → **2 weeks actual** ✅
- [x] **P3.20: Harness Engineering** (4 weeks) → **1 week actual** ✅

### Phase 2: Core Infrastructure (14 weeks)

- [ ] **P4.10: Memory Kernel** (4 weeks)
- [ ] **P4.8: Context Control** (4 weeks)
- [ ] **P4.7: Evolution Layer** (6 weeks)

### Phase 3: Capsule + Canvas (7 weeks)

- [ ] **P3.21: Capsule System** (4 weeks)
- [ ] **P3.22: Canvas Protocol** (3 weeks)

### Phase 4: UI/UX Enhancements (15 weeks)

- [ ] **P3.6-P3.8: Playground System** (7 weeks)
- [ ] **P3.9: MCP Apps** (3 weeks)
- [ ] **P3.10: Chrome Extension** (4 weeks)
- [ ] **P3.13: JSON Render** (3 weeks)
- [ ] **P3.14: Form Surfaces** (2 weeks)

### Phase 5: Advanced + Polish (15 weeks)

- [ ] **P3.12: Operator Browser** (3 weeks)
- [ ] **P3.15: Agent Characterization** (2 weeks)
- [ ] **P3.17: Session Management** (2 weeks)
- [ ] **P3.23: Hooks System** (3 weeks)
- [ ] **P3.24: Environment Standardization** (3 weeks)
- [ ] **P4.9: Multimodal Streaming** (3 weeks)
- [ ] **P4.11: Tambo Integration** (2 weeks)
- [ ] **P4.12: Autonomous Code Factory** (3 weeks)
- [ ] **P4.13-P4.15: GC + Quality + Audit** (4 weeks)

---

## New Tasks Added (Post-Audit)

### From Brainstorm Gap Analysis

| Task | Source | Effort | Priority |
|------|--------|--------|----------|
| P3.9: MCP Apps Integration | mcp-apps.md | 3 weeks | HIGH |
| P3.10: Chrome Extension | A2R_Chrome_Extension_Map.md | 4 weeks | HIGH |
| P3.11: Avatar Engine | Avatar_Engine.md | 2 weeks | MEDIUM |
| P3.12: Operator Browser Tool | operator-mapping.md | 3 weeks | HIGH |
| P3.13: JSON Render / UGI | json-render-UGI.md | 3 weeks | MEDIUM |
| P3.14: Form Surfaces | form-surfaces.md | 2 weeks | MEDIUM |
| P3.15: Agent Characterization | acf.md | 2 weeks | MEDIUM |
| P3.16: Content Ingestion | markdownforagents.md | 2 weeks | MEDIUM |
| P3.17: Session Management | Context_Manager.md | 2 weeks | MEDIUM |
| P3.18: Ars Contexta | arscontexta GitHub | 3 weeks | MEDIUM |
| P3.21: Capsule System | CapsuleProtocol.md | 4 weeks | CRITICAL |
| P3.22: Canvas Protocol | CanvasProtocol.md | 3 weeks | CRITICAL |
| P3.23: Hooks System | HooksSystem spec | 3 weeks | HIGH |
| P3.24: Environment Standardization | Environment_Spec.md | 3 weeks | HIGH |
| P3.25: Vendor Wrappers | VENDOR_INGESTION_CHECKLIST.md | 2 weeks | MEDIUM |
| P4.7: Evolution Layer | evolution-layer-blueprint.md | 6 weeks | CRITICAL |
| P4.8: Context Control | contextcontrol.md | 4 weeks | CRITICAL |
| P4.9: Multimodal Streaming | minicpm-o-fullduplex.md | 3 weeks | MEDIUM |
| P4.10: Memory Kernel | memora.md + MemoryKernel spec | 4 weeks | CRITICAL |
| P4.11: Tambo Integration | tambo_absorb.md | 2 weeks | MEDIUM |
| P4.12: Autonomous Code Factory | amk.md | 3 weeks | CRITICAL |
| P4.13: Garbage Collection Agents | livingfilestheory.md | 2 weeks | HIGH |
| P4.14: Quality Score System | Frontier-Guidelines.md | 1 week | MEDIUM |
| P4.15: Legacy Spec Audit | Gap Analysis | 1 week | CRITICAL |

---

## SYSTEM_LAW Implementation Status

| LAW Category | Sections | Implementation Status |
|-------------|----------|----------------------|
| LAW-GRD (Guardrails) | 001-010 | ✅ P3.19 + P3.20 |
| LAW-ORG (Organization) | 001-009 | ⚠️ Partial (via other layers) |
| LAW-META (Meta-Law) | 001-008 | ⚠️ Partial (via other layers) |
| LAW-ONT (Ontology) | 001-010 | ✅ P3.19 |
| LAW-ENT (Entities) | 001-002 | ✅ P0.3 + P3.19 |
| LAW-AUT (Autonomy) | 001-005 | ✅ P3.19 + P3.20 |
| LAW-OPS (Operations) | 001-003 | ⚠️ Partial (via other layers) |
| LAW-ENF (Enforcement) | 001-008 | ✅ P3.19 + P3.20 |
| LAW-SEC (Security) | 001-003 | ⚠️ Partial (via other layers) |
| LAW-TOOL (Tools) | 001-002 | ⚠️ Partial (via other layers) |
| LAW-SWM (Swarm) | 001-009 | ✅ P2.1 + P2.5 + P2.6 + P3.19 |
| LAW-TIME (Time) | 001-003 | ⚠️ Partial (via other layers) |
| LAW-QLT (Quality) | 001-003 | ✅ P3.19 + P4.13 + P4.14 |
| LAW-CHG (Change) | 001-003 | ✅ P3.19 + P3.20 |

**Total:** 78 LAW sections, 40+ directly implemented, rest enforced via integration

---

## Code Statistics (P0-P3)

| Phase | Tasks | Lines of Code | Tests | Status |
|-------|-------|---------------|-------|--------|
| P0 | 10 | ~1,500 | - | ✅ 100% |
| P1 | 13 | ~3,000 (existing) | - | ✅ 100% |
| P2 | 13 | ~3,385 | 15 | ✅ 100% |
| P3 (complete) | 2 | 2,200 | 18 | ✅ 100% |
| P3 (pending) | 17 | TBD | TBD | ⏳ 0% |
| P4 (pending) | 15 | TBD | TBD | ⏳ 0% |

**Total Complete:** 36 tasks, ~10,085 lines, 33 tests

---

## Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Scope creep from brainstorm files | HIGH | HIGH | Prioritize critical path, defer nice-to-haves |
| Legacy spec debt | MEDIUM | HIGH | P4.15 Legacy Spec Audit task added |
| Integration complexity | HIGH | MEDIUM | SYSTEM_LAW + Harness provide foundation |
| Test coverage gaps | MEDIUM | MEDIUM | All new crates require tests |
| Documentation drift | LOW | MEDIUM | Living Files doctrine enforced |

---

## Next Immediate Actions

1. **Continue P3 implementation** - Start with P3.21 Capsule System (4 weeks)
2. **OR update MASTER_DAG_TASK_BREAKDOWN.md** - Merge this update into main DAG
3. **OR start Phase 2 Core Infrastructure** - Memory Kernel + Context Control

---

**Document Status:** Ready for integration into MASTER_DAG_TASK_BREAKDOWN.md

**End of Update**
