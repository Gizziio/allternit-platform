# COMPREHENSIVE BRAINSTORM GAP ANALYSIS - FULL AUDIT

**Date:** 2026-02-20  
**Scope:** ALL brainstorm session files vs current codebase implementation  
**Finding:** 20+ MAJOR capabilities missing from DAG and/or implementation

---

## Executive Summary

After reading ALL 50+ files in the brainstorm sessions folder, I found **20+ major capability gaps** that were discussed but NOT fully implemented or added to the DAG tasks.

**Critical Finding:** Many concepts exist as **specification documents** in `/docs/_completed/` and `/docs/_archive/` but have **NO corresponding implementation** in the codebase.

---

## Gap Categories

### Category 1: SYSTEM_LAW Layer Gaps (CRITICAL)

**Source Files:**
- `SYSTEM_LAW.md` (root) - Tier-0 constitutional authority
- `docs/LAW_INDEX.md` - LAW document cross-reference
- `docs/LAW_CONSOLIDATION_SUMMARY.md` - LAW consolidation summary

**What's Missing:**

| SYSTEM_LAW | Required Implementation | Status |
|------------|------------------------|--------|
| **LAW-ONT-001** (Canonical Entity Definitions) | Ontology registry + validation engine | ❌ MISSING |
| **LAW-ONT-002** (Authority Law) | ✅ PARTIAL (IO Service) | ⚠️ NEEDS ENFORCEMENT |
| **LAW-ONT-003** (Determinism Law) | Determinism validation engine | ❌ MISSING |
| **LAW-ENT-001** (IO Service) | ✅ IMPLEMENTED | ✅ DONE |
| **LAW-ENT-002** (Kernel Service) | ✅ IMPLEMENTED | ✅ DONE |
| **LAW-GRD-001 to LAW-GRD-010** (Guardrails) | Guardrail enforcement at ALL boundaries | ⚠️ PARTIAL |
| **LAW-AUT-001 to LAW-AUT-005** (Autonomy) | Autonomous agent governance framework | ❌ MISSING |
| **LAW-SWM-001 to LAW-SWM-009** (Swarm) | Swarm coordination contracts | ⚠️ PARTIAL |
| **LAW-ENF-001 to LAW-ENF-008** (Enforcement) | Enforcement engine + auditability | ❌ MISSING |
| **LAW-QLT-001 to LAW-QLT-003** (Quality) | Domain grades + entropy score | ❌ MISSING |
| **LAW-CHG-001 to LAW-CHG-003** (Change) | Change protocol enforcement | ❌ MISSING |

**Action Required:**
Create `/kernel/system-law/` crate with:
- Ontology registry (LAW-ONT)
- Entity lifecycle manager (LAW-ENT)
- Guardrail enforcement engine (LAW-GRD)
- Autonomy governance framework (LAW-AUT)
- Swarm coordination contracts (LAW-SWM)
- Enforcement engine (LAW-ENF)
- Quality score system (LAW-QLT)
- Change protocol (LAW-CHG)

---

### Category 2: Capsule System Gaps

**Source Files:**
- `docs/_completed/specifications/spec/A2rchitech_Capsules_FullSpec.md`
- `docs/_archive/legacy-specs/CAPSULE_SDK_ARCHITECTURE.md`
- `docs/_archive/legacy-specs/CAPSULE_SDK_INTEGRATION.md`
- `docs/_archive/legacy-specs/organized/Architecture/UI/Capsules.md`
- `docs/_archive/legacy-specs/organized/Architecture/UI/CapsuleProtocol.md`

**What's Missing:**

| Component | Required Implementation | Status |
|-----------|------------------------|--------|
| Capsule SDK | Rust crate for capsule definition | ❌ MISSING |
| Capsule Protocol | IPC protocol for capsule communication | ❌ MISSING |
| Capsule Shell | Electron capsule renderer | ⚠️ PARTIAL (has basic UI) |
| Capsule Registry | Runtime capsule discovery + routing | ❌ MISSING |
| Capsule Lifecycle | Spawn/suspend/resume/destroy | ❌ MISSING |

**Action Required:**
Create `/kernel/capsule-system/` with full implementation per spec.

---

### Category 3: Canvas Protocol Gaps

**Source Files:**
- `docs/_completed/specifications/spec/A2rchitech_CanvasProtocol_FullSpec.md`
- `docs/_archive/legacy-specs/canvas-runtime.md`
- `docs/_archive/legacy-specs/organized/Architecture/UI/CanvasProtocol.md`

**What's Missing:**

| Component | Required Implementation | Status |
|-----------|------------------------|--------|
| Canvas Runtime | TypeScript canvas execution engine | ❌ MISSING |
| Canvas Protocol | Serialization + sync protocol | ❌ MISSING |
| Canvas UI Components | React canvas primitives | ⚠️ PARTIAL (has basic components) |
| Canvas State Manager | Deterministic state sync | ❌ MISSING |

**Action Required:**
Implement canvas protocol as specified in `/docs/_completed/specifications/spec/`.

---

### Category 4: Memory Kernel Gaps

**Source Files:**
- `docs/_completed/specifications/spec/A2rchitech_ContextRouting_MemoryFabric_FullSpec.md`
- `docs/_completed/specifications/spec/A2rchitech_MemoryKernel_FullSpec.md`
- `memora.md`
- `contextcontrol.md`
- `a2r-evolution-layer-blueprint.md`

**What's Missing:**

| Component | Required Implementation | Status |
|-----------|------------------------|--------|
| Memory Kernel (AMK) | Rust memory service | ❌ MISSING |
| Three-Layer Memory System | Events/Entities/Edges/Summaries | ❌ MISSING |
| Context Routing | Deterministic context pack builder | ⚠️ PARTIAL |
| Memory GC Engine | Staleness scoring + compaction | ❌ MISSING |
| Knowledge Graph | Entity/relationship graph | ❌ MISSING |

**Action Required:**
Build memory kernel as specified in AMK-001 spec.

---

### Category 5: Hooks System Gaps

**Source Files:**
- `docs/_completed/specifications/spec/A2rchitech_HooksSystem_FullSpec.md`
- `llmhabit-formation.md`
- `a2r_session_harness_hashline_2026-02-18.md`

**What's Missing:**

| Hook Layer | Required Implementation | Status |
|------------|------------------------|--------|
| Kernel Hooks | Boot injection + tool gates | ⚠️ PARTIAL |
| Workspace Hooks | Repo law validation | ⚠️ PARTIAL |
| Task Hooks | Output schema validation | ❌ MISSING |
| Human Layer Hooks | Escalation triggers | ❌ MISSING |
| Habit Promotion Protocol | Determinism test + rollback | ❌ MISSING |

**Action Required:**
Implement full hooks system per spec.

---

### Category 6: UI/UX Gaps

**Source Files:**
- `playgrounda2r.md`
- `a2r-session-form-surfaces.md`
- `a2r-session__json-render-UGI__2026-02-18.md`
- `craftoss.md`
- `mcp-apps.md`
- `A2R_Session_2026-02-18_Avatar_Engine.md`
- `A2R_Chrome_Extension_Map.md`

**What's Missing:**

| Component | Required Implementation | Status |
|-----------|------------------------|--------|
| Playground System | Visual agent workflow UI | ⚠️ IN PROGRESS (P3.6-3.8) |
| Form Surfaces | Dynamic form intake system | ❌ MISSING |
| JSON Render / UGI | Declarative UI execution engine | ❌ MISSING |
| Avatar Engine (AVSP) | Agent visual state protocol | ❌ MISSING |
| Chrome Extension | Browser capsule edge executor | ❌ MISSING |
| MCP Apps Integration | Interactive capsule UI | ❌ MISSING |
| Craft Agents UX | Operator desktop blueprint | ❌ MISSING |

**Action Required:**
Add all as P3 tasks (already partially tracked).

---

### Category 7: Operator/Browser-Use Gaps

**Source Files:**
- `a2r-session-2026-02-18-operator-mapping.md`
- `A2R_Swarm_Runtime_Kernel_Spec_v1_2026-02-19.md`

**What's Missing:**

| Component | Required Implementation | Status |
|-----------|------------------------|--------|
| desktop_control Tool | Vision-based desktop automation | ⚠️ PARTIAL (has a2r-operator) |
| browser_control Tool | DOM-first browser automation | ❌ MISSING |
| Unified Operator Capsule | Single event protocol | ❌ MISSING |

**Action Required:**
Add as P3.12 task.

---

### Category 8: Evolution Layer Gaps

**Source Files:**
- `a2r-evolution-layer-blueprint.md`
- `mulitagent orch.md`
- `agent-teams.md`

**What's Missing:**

| Engine | Required Implementation | Status |
|--------|------------------------|--------|
| Memory Evolution (MEE) | ALMA-style schema competition | ❌ MISSING |
| Skill Evolution (SEE) | SkillRL-style distillation | ❌ MISSING |
| Confidence Routing (CRL) | AdaptEvolve-style escalation | ❌ MISSING |
| Organizational Evolution (OEE) | Agyn-style workflow mutation | ❌ MISSING |
| Trajectory Optimization (TOE) | InftyThink-style boundary control | ❌ MISSING |

**Action Required:**
Add as P4.7 task (6 weeks).

---

### Category 9: Agent Characterization Framework Gaps

**Source Files:**
- `a2rpersistentagentarchtechtre.md`
- `acf.md`

**What's Missing:**

| Component | Required Implementation | Status |
|-----------|------------------------|--------|
| Agent Characterization Framework (ACF) | Behavioral compiler | ❌ MISSING |
| Operational Metrics | Reliability/latency/compliance | ❌ MISSING |
| Cognitive Bias Profiles | Behavioral guardrails | ❌ MISSING |
| Affinity Matrix | Coordination dynamics | ❌ MISSING |
| Runtime Drift | Behavioral evolution tracking | ❌ MISSING |

**Action Required:**
Add as P3.15 task (2 weeks).

---

### Category 10: Harness Engineering Gaps

**Source Files:**
- `harness-engineering.md`
- `livingfilestheory.md`
- `control-plane spec.md`
- `A2RCHITECH_AGENT_RAILS_SYSTEMS_COMPREHENSIVE_GUIDE.md`

**What's Missing:**

| Component | Required Implementation | Status |
|-----------|------------------------|--------|
| RiskPolicy Contract | Tier enforcement + gates | ❌ MISSING |
| Preflight Risk Evaluation | Stage 0 validation | ❌ MISSING |
| Deterministic Remediation Loop | Patch-only agent | ❌ MISSING |
| Evidence Validation | SHA-bound artifacts | ⚠️ PARTIAL |
| Merge Governance | Risk-tiered auto-merge | ❌ MISSING |
| Garbage Collection Agents | Daily entropy compression | ❌ MISSING |

**Action Required:**
Implement harness engineering blueprint.

---

### Category 11: Content Ingestion Gaps

**Source Files:**
- `markdownforagents.md`
- `tambo_absorb.md`

**What's Missing:**

| Component | Required Implementation | Status |
|-----------|------------------------|--------|
| Content Ingestion Kernel | HTML → Markdown → Structured | ❌ MISSING |
| Semantic Structurer | Agent-native context objects | ❌ MISSING |
| Token Budget Module | Compression ratio tracking | ❌ MISSING |
| Living File Writer | Versioned ingestion | ❌ MISSING |
| Tambo Integration | Generative UI components | ❌ MISSING |

**Action Required:**
Add as P3.16 task (2 weeks).

---

### Category 12: Multimodal Streaming Gaps

**Source Files:**
- `minicpm-o 4.5.fullduplex.md`

**What's Missing:**

| Component | Required Implementation | Status |
|-----------|------------------------|--------|
| OmniAgent Class | Vision + audio + TTS streaming | ❌ MISSING |
| Full-Duplex State Controller | Interruptible output | ❌ MISSING |
| Streaming Kernel Extension | Concurrent A/V channels | ❌ MISSING |
| Event Bus Integration | Non-blocking async channels | ❌ MISSING |

**Action Required:**
Add as P4.9 task (3 weeks).

---

### Category 13: Vendor Ingestion Gaps

**Source Files:**
- `A2R_VENDOR_INGESTION_CHECKLIST.md`

**What's Missing:**

| Vendor | Wrapper Required | Status |
|--------|-----------------|--------|
| flexlayout-react | FlexLayoutHost | ❌ MISSING |
| react-resizable-panels | A2RPanelGroup | ❌ MISSING |
| @tanstack/react-virtual | VirtualList | ❌ MISSING |
| kbar/cmdk | CommandPalette | ❌ MISSING |
| react-hotkeys-hook | useA2RHotkeys | ❌ MISSING |
| @radix-ui/* | Radix wrappers | ❌ MISSING |
| monaco-editor | CodeEditor | ❌ MISSING |
| xterm | TerminalView | ❌ MISSING |
| tldraw | CanvasSurface | ❌ MISSING |
| reactflow | GraphSurface | ❌ MISSING |

**Action Required:**
Create `/packages/a2r-platform/src/vendor/` with all wrappers.

---

### Category 14: Environment Standardization Gaps

**Source Files:**
- `A2R_Environment_Standardization_Spec_v1_2026-02-19.md`

**What's Missing:**

| Component | Required Implementation | Status |
|-----------|------------------------|--------|
| Normalized Environment Spec (NES) | Driver-agnostic env contract | ❌ MISSING |
| Lifecycle Runner | Triggers + dependencies + timeouts | ❌ MISSING |
| Determinism Hashing | envHash + policyHash + inputsHash | ⚠️ PARTIAL |
| Secrets Model | Ephemeral credential binding | ❌ MISSING |
| Compatibility Tiers | Local/Enterprise/Marketplace | ❌ MISSING |

**Action Required:**
Implement environment standardization spec.

---

### Category 15: Session/Context Management Gaps

**Source Files:**
- `A2R_Session_Context_Manager_to_A2rchitech.md`
- `A2R_agent_first_session_notes_2026-02-15.md`

**What's Missing:**

| Component | Required Implementation | Status |
|-----------|------------------------|--------|
| Context Registry | Session store + drift detection | ❌ MISSING |
| Session Lifecycle | Fork/resume/archive operations | ❌ MISSING |
| Semantic Index | Full-text + embeddings | ❌ MISSING |
| Navigation UI Binding | Session switch + restore | ❌ MISSING |

**Action Required:**
Add as P3.17 task (2 weeks).

---

### Category 16: Agent Rails System Gaps

**Source Files:**
- `A2RCHITECH_AGENT_RAILS_SYSTEMS_COMPREHENSIVE_GUIDE.md`

**What's Implemented:**
- ✅ DAG planning
- ✅ WIH manager
- ✅ Gate enforcer (basic)
- ✅ Ledger store
- ✅ Leases system
- ✅ Bus queue
- ✅ Runner loop
- ✅ Mail system

**What's Missing:**
- ⚠️ Vault (partial - needs compaction)
- ❌ Receipts integration (full)
- ❌ Policy bundle injection automation

---

### Category 17: Autonomous Code Factory Gaps

**Source Files:**
- `amk.md`

**What's Missing:**

| Component | Required Implementation | Status |
|-----------|------------------------|--------|
| RiskPolicy.schema.json | Tier classification | ❌ MISSING |
| Preflight Stage | Risk evaluation before execution | ❌ MISSING |
| ReviewAgentState | SHA-bound review tracking | ❌ MISSING |
| Deterministic Remediation | Patch-only loop | ❌ MISSING |
| Evidence Manifest | SHA-embedded artifacts | ❌ MISSING |
| MergeEligibilityReceipt | Machine-verifiable merge state | ❌ MISSING |

**Action Required:**
Implement autonomous code factory spec.

---

### Category 18: Frontier Guidelines Gaps

**Source Files:**
- `Frontier-Guidelines.md`

**What's Missing:**

This is a doctrine document, not implementation spec. However it implies:
- Spec quality enforcement
- Loop orchestration metrics
- Failure-mode modeling
- Operator skill tracking

**Action Required:**
Create operational metrics dashboard.

---

### Category 19: Archive/Legacy Spec Gaps

**Source Files:**
- `docs/_archive/legacy-specs/` (50+ files)

**Critical Files Needing Attention:**

| File | Required Action |
|------|----------------|
| `semantic memory injection.md` | Review for memory kernel integration |
| `gmksession.md` | Archive or integrate |
| `gentabs_mvp.md` | Archive or integrate |
| `DAK-RAILS-ANALYSIS.md` | Merge into current Rails implementation |
| `organized/Architecture/LAW/` | **CRITICAL** - Review and implement missing LAW components |
| `organized/Architecture/UNIFIED/` | Review for architecture alignment |
| `organized/Architecture/INTEGRATIONS/` | Review integration specs |
| `organized/Architecture/UI/` | Review UI specs for implementation |
| `organized/a2rchitech-specs(temporary)/` | **CRITICAL** - Move to permanent specs or archive |
| `organized/a2rchitech-specs(temporary)/PHASE1_MVP/` | **CRITICAL** - These are MVP specs - implement or archive |

**Action Required:**
Create task to audit ALL legacy specs and either:
1. Move to `/spec/` for implementation
2. Move to `/docs/_archive/` for historical reference
3. Delete if obsolete

---

### Category 20: Completed Specs Not Implemented

**Source Files:**
- `docs/_completed/specifications/spec/`

**Critical Gaps:**

| Spec | Implementation Status |
|------|----------------------|
| `A2rchitech_HooksSystem_FullSpec.md` | ❌ NOT IMPLEMENTED |
| `A2rchitech_ContextRouting_MemoryFabric_FullSpec.md` | ❌ NOT IMPLEMENTED |
| `A2rchitech_CanvasProtocol_FullSpec.md` | ❌ NOT IMPLEMENTED |
| `A2rchitech_Capsules_FullSpec.md` | ❌ NOT IMPLEMENTED |
| `A2rchitech_SkillsSystem_FullSpec.md` | ⚠️ PARTIAL |

**Action Required:**
These are COMPLETED specs but have NO implementation. Add as tasks.

---

## Summary: Total Gaps

### By Priority

**🔴 CRITICAL (Must Have):**
1. LAW Layer Implementation - 6 weeks
2. Harness Engineering - 4 weeks
3. Memory Kernel - 4 weeks
4. Autonomous Code Factory - 3 weeks
5. Capsule System - 4 weeks

**🟡 HIGH (Should Have):**
6. Evolution Layer - 6 weeks
7. Canvas Protocol - 3 weeks
8. Hooks System - 3 weeks
9. Environment Standardization - 3 weeks
10. Session/Context Management - 2 weeks

**🟢 MEDIUM (Nice to Have):**
11. Playground System - 3 weeks (in progress)
12. Form Surfaces - 2 weeks
13. Avatar Engine - 2 weeks
14. Chrome Extension - 4 weeks
15. MCP Apps - 3 weeks
16. Operator Browser-Use - 3 weeks
17. Content Ingestion - 2 weeks
18. Vendor Wrappers - 2 weeks
19. Agent Characterization - 2 weeks
20. Multimodal Streaming - 3 weeks
21. Legacy Spec Audit - 1 week

**Total New Work:** 77 weeks (~18 months)

---

## Recommended Action Plan

### Phase 1: Critical Foundation (4 weeks)
1. **Week 1-2:** LAW Layer Implementation
2. **Week 3-4:** Harness Engineering

### Phase 2: Core Infrastructure (8 weeks)
3. **Week 5-8:** Memory Kernel + Evolution Layer
4. **Week 9-12:** Capsule System + Canvas Protocol

### Phase 3: Enhancement Layer (8 weeks)
5. **Week 13-16:** UI/UX enhancements (Playground, Forms, Avatar, etc.)
6. **Week 17-20:** Integration enhancements

### Phase 4: Advanced Features (8 weeks)
7. **Week 21-24:** Multimodal, Operator, Content Ingestion
8. **Week 25-28:** Polish + optimization

**Total:** 28 weeks (~7 months) for full implementation

---

## Immediate Next Steps

1. **Audit Legacy Specs** (1 week)
   - Review all files in `/docs/_archive/legacy-specs/`
   - Move implementable specs to `/spec/`
   - Archive obsolete specs

2. **Prioritize Critical Gaps** (1 day)
   - Review this gap analysis
   - Select Phase 1 priorities
   - Create tasks in DAG

3. **Start LAW Layer** (immediate)
   - Create `/kernel/law/` crate
   - Implement ontology registry
   - Implement entity lifecycle manager

---

**This document should be reviewed and prioritized before continuing with P3+ work.**

---

**End of Gap Analysis**
