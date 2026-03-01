# A2R DAG TASKS - COMPLETE WORKLOAD REPORT

**Date:** 2026-02-23
**Purpose:** Full inventory of all remaining DAG tasks + BrowserAgent spec alignment

---

## 1. BROWSERAGENT SPEC FINDINGS

**Location:** `/Users/macbook/Desktop/spec/BrowserAgent/`

### Key Documents:
1. **ShellUIAgenticBrowser.md** - Core architecture spec
2. **ActionContract.json** - Browser action schema (11 action types)
3. **Receipts.json** - Evidence receipt schema
4. **PolicyTiers.md** - Risk tier model (Tier 0-4)
5. **ExtensionMV3.md** - Chrome extension spec

### Critical Requirements:
- **Renderer Separation:** HUMAN (BrowserView) vs AGENT (Playwright)
- **5 Subsystems:** Session Manager, Page Sensor, Action Engine, Policy Engine, Evidence Store
- **DAG Integration:** Browser runs as DAG nodes with receipts attached to WIH
- **Budgets:** Step budget (25 actions), Time budget (5 min default)
- **Suspend/Resume:** Checkpoint persistence required
- **Security:** Default deny, prompt injection hardening, sensitive data redaction

### Action Types (11):
1. Navigate
2. Click
3. Type
4. Select
5. Scroll
6. Wait
7. Assert
8. Extract
9. Screenshot
10. Download
11. ConfirmGate (Tier 3+ confirmation)

### Policy Tiers (0-4):
- **Tier 0:** Read-only (capture, screenshot, extract)
- **Tier 1:** Low-impact navigation (scroll, expand menus)
- **Tier 2:** Form fill without commit
- **Tier 3:** Commit actions (requires human confirmation)
- **Tier 4:** Irreversible changes (requires secondary confirmation)

---

## 2. ORIGINAL DAG TASKS (From OPEN_DAG_TASKS_COMPLETE_LIST.md)

### P0-P3: COMPLETE ✅
| Phase | Tasks | Status |
|-------|-------|--------|
| P0 | 10 | ✅ 100% |
| P1 | 13 | ✅ 100% |
| P2 | 13 | ✅ 100% |
| P3 | 7 | ✅ 100% |

### P4: Advanced Features (14 tasks, 1 complete)

#### CRITICAL Priority (5 tasks, 7 weeks)
| ID | Task | Effort | Dependencies | Status |
|----|------|--------|--------------|--------|
| P4.16 | Agentation Integration | 2w | None | ⏳ OPEN |
| P4.17 | Storybook Evidence Lane | 2w | P4.16 | ⏳ OPEN |
| P4.19 | Ontology Runtime Binding | 2w | P3.19 | ⏳ OPEN |
| P4.20 | Evaluation Harness | 2w | P4.16, P4.19 | ⏳ OPEN |
| P4.23 | Purpose Binding | 1w | P3.20 | ⏳ OPEN |

#### HIGH Priority (3 tasks, 4 weeks)
| ID | Task | Effort | Dependencies | Status |
|----|------|--------|--------------|--------|
| P4.18 | UI Contracts + Agent Roles | 1w | P4.17 | ⏳ OPEN |
| P4.21 | Checkpointing / Recovery | 1w | P2.1 | ⏳ OPEN |
| P4.22 | Observability Dashboard | 2w | P4.21 | ⏳ OPEN |

#### MEDIUM Priority (5 tasks, 19 weeks)
| ID | Task | Effort | Dependencies | Status |
|----|------|--------|--------------|--------|
| P4.1 | Swarm Scheduler Advanced | 2w | P2.1 | ⏳ OPEN |
| P4.2 | Policy Service | 2w | P1.1 | ⏳ OPEN |
| P4.3 | Task Executor | 2w | P2.2 | ⏳ OPEN |
| P4.4 | Presentation Kernel | 1w | P3.5 | ⏳ OPEN |
| P4.5 | Directive Compiler | 2w | P1.3 | ⏳ OPEN |
| P4.6 | IVKGE Advanced | 2w | P3.4 | ⏳ OPEN |
| P4.7 | VPS Partnership | 1w | P2.8 | ⏳ OPEN |
| P4.9 | Multimodal Streaming | 3w | P4.10 | ⏳ OPEN |
| P4.11 | Tambo Integration | 2w | P3.22 | ⏳ OPEN |
| P4.13 | GC Agents | 1w | P4.7 | ⏳ OPEN |

#### COMPLETE (1 task)
| ID | Task | Status |
|----|------|--------|
| P4.15 | Legacy Spec Audit | ✅ Complete |

### P5: Browser Agent System (5 tasks)

#### CRITICAL Priority (4 tasks, 5 weeks)
| ID | Task | Effort | Dependencies | Status |
|----|------|--------|--------------|--------|
| P5.1.2 | Receipts Schema | 1w | P4.15 | ⏳ OPEN |
| P5.1.3 | Policy Tier Gating | 1w | P3.20 | ⏳ OPEN |
| P5.2.1 | ShellUI BrowserView Integration | 2w | P5.1.2, P5.1.3 | ⏳ OPEN |
| P5.5 | Security Hardening | 1w | P5.1.3 | ⏳ OPEN |

#### HIGH Priority (1 task, 2 weeks)
| ID | Task | Effort | Dependencies | Status |
|----|------|--------|--------------|--------|
| P5.4 | DAG/WIH Integration | 2w | P5.2.1 | ⏳ OPEN |

---

## 3. DEFERRED TASKS (13 weeks, NOT on critical path)

| ID | Task | Effort | Reason |
|----|------|--------|--------|
| P4.1 | Swarm Scheduler Advanced | 2w | Scaling feature |
| P4.2 | Policy Service | 2w | Policy exists in harness |
| P4.3 | Task Executor | 2w | Execution exists |
| P4.4 | Presentation Kernel | 1w | UI layer, not blocking |
| P4.5 | Directive Compiler | 2w | Enhancement to planning |
| P4.6 | IVKGE Advanced | 2w | Visual features |
| P4.7 | VPS Partnership | 1w | Deployment optimization |
| P4.9 | Multimodal Streaming | 3w | Vision/audio, not core |
| P4.11 | Tambo Integration | 2w | UI generation, not core |
| P4.13 | GC Agents | 1w | Cleanup, not blocking |

---

## 4. CRITICAL PATH TO MVP (12 weeks)

```
Phase 1: Foundation (Weeks 1-4)
├── P4.16: Agentation Integration (2w)
└── P4.17: Storybook Evidence Lane (2w)
    └── P4.19: Ontology Runtime Binding (2w, parallel)

Phase 2: Quality Gates (Weeks 5-8)
├── P4.20: Evaluation Harness (2w)
├── P4.23: Purpose Binding (1w, parallel)
├── P5.1.2: Receipts Schema (1w)
└── P5.1.3: Policy Tier Gating (1w, parallel)

Phase 3: Browser Agent MVP (Weeks 9-12)
├── P5.2.1: ShellUI BrowserView Integration (2w)
├── P5.5: Security Hardening (1w)
└── P5.4: DAG/WIH Integration (2w)
```

---

## 5. WHAT I'VE ALREADY IMPLEMENTED

### Backend Crates (4 crates, ~3,000 lines)
- ✅ `a2r-swarm-advanced` - Message bus, circuit breaker, quarantine
- ✅ `a2r-ivkge-advanced` - Visual extraction, OCR, corrections
- ✅ `a2r-multimodal-streaming` - Vision/audio streaming
- ✅ `a2r-tambo-integration` - UI generation

### API Routes (4 files, ~2,000 lines)
- ✅ `7-apps/api/src/swarm_routes.rs` - 8 endpoints
- ✅ `7-apps/api/src/ivkge_routes.rs` - 8 endpoints
- ✅ `7-apps/api/src/multimodal_routes.rs` - 6 endpoints (3 WebSocket)
- ✅ `7-apps/api/src/tambo_routes.rs` - 11 endpoints

### UI Components (5 components, ~1,750 lines)
- ✅ `SwarmDashboard.tsx`
- ✅ `IVKGEPanel.tsx`
- ✅ `MultimodalInput.tsx`
- ✅ `TamboStudio.tsx`
- ✅ `DagIntegrationPage.tsx`

### ShellUI Integration (Partially Complete)
- ✅ ViewType definitions added to `nav.types.ts`
- ✅ Views registered in `ShellApp.tsx`
- ✅ Navigation items added to `rail.config.ts`
- ⏳ BrowserAgentBar - NOT YET IMPLEMENTED
- ⏳ BrowserAgentOverlay - NOT YET IMPLEMENTED
- ⏳ ControlCenter - NOT YET IMPLEMENTED
- ⏳ EnvironmentSelector - NOT YET IMPLEMENTED
- ⏳ Console Drawer tabs (DAG Graph, Receipts) - NOT YET IMPLEMENTED

---

## 6. WHAT STILL NEEDS TO BE DONE

### Phase 1: Browser Agent Bar & Session Observability (6-8 hours)
**Aligned with BrowserAgent spec:**
- P1.1: BrowserAgentEvent stream type (matches Receipts.json trace events)
- P1.2: BrowserAgentBar component (matches ShellUIAgenticBrowser.md UX requirements)
- P1.3: BrowserAgentOverlay component (matches "Agent Acting" indicator spec)
- P1.4: DAG Graph tab (current run only)
- P1.5: Receipts tab (matches Receipts.json schema)
- P1.6: Tab placeholders (Trace, Browser Chat)

**BrowserAgent Spec Alignment:**
- ✅ ActionContract.json → BrowserAgentEvent types
- ✅ Receipts.json → ReceiptsView component
- ✅ PolicyTiers.md → Status pill states (Idle/Running/Waiting/Blocked/Done)
- ✅ ShellUIAgenticBrowser.md → "Agent Acting" indicator, controls

### Phase 2: Control Center Overlay (4-6 hours)
- P2.1: ControlCenter component shell
- P2.2: Compute & Runtimes section (8-cloud crates integration)
- P2.3: Secrets & Credentials section
- P2.4: SSH Connections section
- P2.5: Browser Pairing section (ExtensionMV3.md pairing flow)
- P2.6: Policies section (PolicyTiers.md)
- P2.7: Dev Tools section (Agentation toggle)

### Phase 3: Environment Selector (2-3 hours)
- P3.1: EnvironmentSelector component
- P3.2: Environment state management

### Phase 4: Agentation Hybrid Access (2-3 hours)
- P4.1: Agentation Control Center toggle
- P4.2: Agentation Browser context menu
- P4.3: Keyboard shortcut (optional)

---

## 7. NARROWED SCOPE RECOMMENDATION

Based on BrowserAgent spec + original DAG tasks, here's the **minimum viable scope**:

### Must-Have for Browser Agent MVP:
1. **BrowserAgentBar** (P1.2) - Primary agentic browsing surface
2. **BrowserAgentOverlay** (P1.3) - "Agent Acting" indicator
3. **Receipts Tab** (P1.5) - Evidence receipts per Receipts.json
4. **Policy Gating** (P2.6) - Tier enforcement per PolicyTiers.md
5. **Browser Pairing** (P2.5) - Extension MV3 pairing flow

### Can Defer:
1. DAG Graph tab (P1.4) - Nice to have, not critical for MVP
2. Trace tab (P1.6) - Depends on event schema decisions
3. Browser Chat tab (P1.6) - Depends on message model
4. Most Control Center sections (P2.2-P2.4, P2.7) - Can use existing cloud-deploy UI
5. Environment Selector (P3) - Can wait until multi-runtime needed
6. Agentation (P4) - Dev tool, not user-facing

---

## 8. RECOMMENDED NEXT STEPS

**Start with Phase 1, but narrow to:**
1. P1.1: BrowserAgentEvent stream type (30 min)
2. P1.2: BrowserAgentBar component (2-3 hours)
3. P1.3: BrowserAgentOverlay component (2-3 hours)
4. P1.5: Receipts tab (1-2 hours)

**Total: ~6-7 hours for Browser Agent MVP core**

This aligns with:
- BrowserAgent spec requirements
- Original P5.2.1 DAG task (ShellUI BrowserView Integration)
- User-facing value (agentic browsing works)

**Then reassess** before continuing with Control Center, Environment Selector, etc.

---

**End of Report**
