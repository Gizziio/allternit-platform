# PRIORITIZED REMAINING DAG TASKS

**Date:** 2026-02-20  
**Analysis:** All DAG tasks reviewed and prioritized  
**Basis:** Dependencies, Value, Risk, Effort

---

## Current Status

**Completed:** 48 tasks (P0-P3 100%, P4 33%)  
**Remaining P4:** 10 tasks (~23 weeks original estimate)  
**New P5:** 22 tasks (17 weeks including research)  
**Total Remaining:** 32 tasks (~40 weeks)

---

## Priority Tiers

### 🔴 TIER 1: CRITICAL (Do First - 4 weeks)

**These unblock other work and deliver foundational capabilities.**

| Task | Effort | Why First | Dependencies |
|------|--------|-----------|--------------|
| **P4.15: Legacy Spec Audit** | 1 week | May reveal existing capabilities, reduce scope | None |
| **P5.0: Browser Agent Research** | 2 weeks | Major capability gap, research before implementation | None |
| **P4.13: Garbage Collection Agents** | 1 week | Prevents entropy accumulation, system health | P4.7 (Evolution Layer ✅) |

**Total:** 4 weeks

**Rationale:**
- P4.15 may reveal existing browser capabilities or simpler approaches
- P5.0 research is prerequisite for ALL browser implementation
- P4.13 keeps system healthy while building new features

---

### 🟡 TIER 2: HIGH VALUE (Do Second - 8 weeks)

**These deliver major user-facing capabilities.**

| Task | Effort | Why Second | Dependencies |
|------|--------|------------|--------------|
| **P5.1: Browser Agent Core** | 4 weeks | Foundation for browser automation | P5.0 (Research) |
| **P5.2: ShellUI Native Browser** | 3 weeks | Primary agentic browsing surface | P5.1 (Core) |
| **P5.5: Security Hardening** | 1 week | Required for safe browser automation | P5.1 (Core) |

**Total:** 8 weeks

**Rationale:**
- Browser automation is the largest capability gap
- Core + ShellUI + Security = Minimum Viable Browser Agent
- Extension (P5.3) can wait, ShellUI is primary surface

---

### 🟢 TIER 3: IMPORTANT (Do Third - 10 weeks)

**These enhance the platform but aren't blocking.**

| Task | Effort | Why Third | Dependencies |
|------|--------|-----------|--------------|
| **P4.9: Multimodal Streaming** | 3 weeks | Vision + audio for agents | P4.10 (Memory Kernel ✅) |
| **P4.11: Tambo Integration** | 2 weeks | UI generation capability | P3.22 (Canvas Protocol ✅) |
| **P5.3: Chrome Extension MV3** | 3 weeks | External browser surface | P5.1 (Core) |
| **P5.4: DAG/WIH Integration** | 2 weeks | Browser integration with DAG | P5.1 (Core), P5.2 (ShellUI) |

**Total:** 10 weeks

**Rationale:**
- Multimodal is important for modern agents
- Tambo provides UI generation
- Extension is secondary to ShellUI
- DAG integration important but can follow core implementation

---

### 🔵 TIER 4: ENHANCEMENTS (Do Later - 18 weeks)

**These are nice-to-have or require stable foundation.**

| Task | Effort | Why Later | Dependencies |
|------|--------|-----------|--------------|
| **P4.1: Swarm Scheduler Advanced** | 2 weeks | Requires stable scheduler | P2.1 (Scheduler ✅) |
| **P4.2: Policy Service** | 2 weeks | Policy exists in harness | P1.1 (Policy Engine ✅) |
| **P4.3: Task Executor** | 2 weeks | Execution exists | P2.2 (WorkerManager ✅) |
| **P4.4: Presentation Kernel** | 1 week | UI layer, not blocking | P3.5 (Context Pack ✅) |
| **P4.5: Directive Compiler** | 2 weeks | Enhancement to planning | P1.3 (Context Pack ✅) |
| **P4.6: IVKGE Advanced** | 2 weeks | Visual features | P3.4 (Output Studio) |
| **P5.6: Site Adapters** | 2 weeks | Optional reliability | P5.1 (Core) |
| **P4.7-P4.10: Swarm Advanced** | 5 weeks | Scaling features | All core features |

**Total:** 18 weeks

**Rationale:**
- These enhance existing capabilities
- Can be built after core is stable
- Some may be simplified by research findings

---

## Recommended Execution Order

### Phase 1: Foundation (4 weeks) 🔴
```
Week 1:  P4.15 - Legacy Spec Audit
Week 2-3: P5.0 - Browser Agent Research
Week 4:  P4.13 - Garbage Collection Agents
```

**Deliverables:**
- Research reports (ShellUI, Capsules, Playwright, Evidence)
- Legacy spec audit findings
- GC agents running

**Decision Point:** After research, may adjust P5 implementation scope

---

### Phase 2: Browser Agent MVP (8 weeks) 🟡
```
Week 5-8:  P5.1 - Browser Agent Core
Week 9-11: P5.2 - ShellUI Native Browser
Week 12:   P5.5 - Security Hardening
```

**Deliverables:**
- Action Contract (12 action types)
- Receipts Schema
- Policy Tier gating
- ShellUI browser tab with agent automation
- Security hardening complete

**Milestone:** Minimum Viable Browser Agent operational

---

### Phase 3: Enhancement (10 weeks) 🟢
```
Week 13-15: P4.9 - Multimodal Streaming
Week 16-17: P4.11 - Tambo Integration
Week 18-20: P5.3 - Chrome Extension MV3
Week 21-22: P5.4 - DAG/WIH Integration
```

**Deliverables:**
- Vision + audio streaming
- UI generation from Tambo
- Chrome Extension surface
- Browser actions in DAG

---

### Phase 4: Polish & Scale (18 weeks) 🔵
```
Week 23-40: Tier 4 enhancements (as needed)
```

**Deliverables:**
- Advanced swarm features
- Policy service
- Task executor enhancements
- Site adapters (optional)

---

## Critical Path Summary

**Minimum to Browser Agent (12 weeks):**
- Tier 1 (4 weeks) + Tier 2 (8 weeks)

**Full Platform (40 weeks):**
- All tiers complete

**With Research Findings:**
- May reduce scope if existing capabilities found
- May identify simpler approaches

---

## Risk Mitigation

### High-Risk Items
1. **P5.0 Research** - May reveal major gaps in ShellUI
   - **Mitigation:** Early audit, adjust scope if needed
   
2. **P5.2 ShellUI** - BrowserView integration complex
   - **Mitigation:** Playwright research first, simple MVP

3. **P5.5 Security** - Prompt injection hardening
   - **Mitigation:** Security team involvement early

### Low-Risk Items
1. **P4.15 Legacy Audit** - Pure research, no implementation risk
2. **P4.13 GC Agents** - Builds on existing evolution layer
3. **P4.9 Multimodal** - Streaming is well-understood pattern

---

## Resource Allocation

### Recommended Team
- **1-2 Backend Engineers:** P5.1 Core, P5.2 ShellUI, P4.13 GC
- **1 Frontend Engineer:** P5.2 ShellUI UI, P5.3 Extension
- **1 Security Engineer:** P5.5 Security (part-time)
- **1 Researcher:** P5.0 Research, P4.15 Audit

### Timeline Reality Check
- **12 weeks to Browser Agent MVP** with focused team
- **40 weeks to full platform** with current team size
- **Research may reduce timeline** if capabilities exist

---

## Decision Required

**Choose one:**

### Option A: Browser Agent First (Recommended)
- Start with Tier 1 (P4.15, P5.0, P4.13)
- Focus on browser automation
- Defer swarm/policy enhancements

### Option B: Complete P4 First
- Finish all original P4 tasks
- Then start P5 Browser Agent
- More balanced but delays browser capability

### Option C: Parallel Tracks
- Tier 1 + start Tier 2 while research ongoing
- Faster but more risk
- Requires larger team

---

**My Recommendation: Option A**

**Rationale:**
1. Browser automation is the largest capability gap
2. Research first reduces implementation risk
3. GC agents keep system healthy during build
4. Swarm/policy enhancements can wait

---

**End of Prioritization**
