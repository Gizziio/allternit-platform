# OPEN DAG TASKS - COMPLETE LIST

**Date:** 2026-02-21  
**Status:** All remaining tasks from P0-P5  
**Total Open:** 18 tasks  
**Total Effort:** ~37 weeks

---

## Summary by Phase

| Phase | Total Tasks | Complete | Open | % Complete |
|-------|-------------|----------|------|------------|
| **P0** | 10 | 10 | 0 | 100% ✅ |
| **P1** | 13 | 13 | 0 | 100% ✅ |
| **P2** | 13 | 13 | 0 | 100% ✅ |
| **P3** | 7 | 7 | 0 | 100% ✅ |
| **P4** | 15 | 1 | 14 | 7% |
| **P5** | 5 | 0 | 5 | 0% |
| **TOTAL** | **63** | **44** | **19** | **70%** |

---

## P4: Advanced Features (14 Open Tasks)

### 🔴 CRITICAL Priority (5 tasks, 7 weeks)

| ID | Task | Effort | Dependencies | Status |
|----|------|--------|--------------|--------|
| **P4.16** | Agentation Integration (Fork & Absorb) | 2 weeks | None | ⏳ OPEN |
| **P4.17** | Storybook Evidence Lane | 2 weeks | P4.16 | ⏳ OPEN |
| **P4.19** | Ontology Runtime Binding | 2 weeks | P3.19 (SYSTEM_LAW) | ⏳ OPEN |
| **P4.20** | Evaluation Harness | 2 weeks | P4.16, P4.19 | ⏳ OPEN |
| **P4.23** | Purpose Binding | 1 week | P3.20 (Harness) | ⏳ OPEN |

---

### 🟡 HIGH Priority (3 tasks, 4 weeks)

| ID | Task | Effort | Dependencies | Status |
|----|------|--------|--------------|--------|
| **P4.18** | UI Contracts + Agent Roles | 1 week | P4.17 | ⏳ OPEN |
| **P4.21** | Checkpointing / Recovery | 1 week | P2.1 (Scheduler) | ⏳ OPEN |
| **P4.22** | Observability Dashboard | 2 weeks | P4.21 | ⏳ OPEN |

---

### 🟡 MEDIUM Priority (5 tasks, 19 weeks)

| ID | Task | Effort | Dependencies | Status |
|----|------|--------|--------------|--------|
| **P4.1** | Swarm Scheduler Advanced (Inter-agent message bus) | 2 weeks | P2.1 | ⏳ OPEN |
| **P4.2** | Policy Service Implementation | 2 weeks | P1.1 | ⏳ OPEN |
| **P4.3** | Task Executor Implementation | 2 weeks | P2.2 | ⏳ OPEN |
| **P4.4** | Presentation Kernel Implementation | 1 week | P3.5 | ⏳ OPEN |
| **P4.5** | Directive Compiler Implementation | 2 weeks | P1.3 | ⏳ OPEN |
| **P4.6** | IVKGE Advanced Features | 2 weeks | P3.4 | ⏳ OPEN |
| **P4.7** | VPS Partnership Integration | 1 week | P2.8 | ⏳ OPEN |
| **P4.9** | Multimodal Streaming | 3 weeks | P4.10 (Memory Kernel) | ⏳ OPEN |
| **P4.11** | Tambo Integration | 2 weeks | P3.22 (Canvas Protocol) | ⏳ OPEN |
| **P4.13** | Garbage Collection Agents | 1 week | P4.7 (Evolution Layer) | ⏳ OPEN |

**Note:** P4.1-P4.6 (Swarm Advanced) may be DEFERRED until critical tasks complete.

---

### ✅ COMPLETE (1 task)

| ID | Task | Completed | Notes |
|----|------|-----------|-------|
| **P4.15** | Legacy Spec Audit | ✅ 2026-02-20 | Revealed browser-runtime 80% exists |

---

## P5: Browser Agent System (5 Open Tasks)

### 🔴 CRITICAL Priority (4 tasks, 5 weeks)

| ID | Task | Effort | Dependencies | Status |
|----|------|--------|--------------|--------|
| **P5.1.2** | Receipts Schema (browser-runtime) | 1 week | P4.15 (Audit) | ⏳ OPEN |
| **P5.1.3** | Policy Tier Gating (browser-runtime) | 1 week | P3.20 (Harness) | ⏳ OPEN |
| **P5.2.1** | ShellUI BrowserView Integration | 2 weeks | P5.1.2, P5.1.3 | ⏳ OPEN |
| **P5.5** | Security Hardening | 1 week | P5.1.3 | ⏳ OPEN |

---

### 🟡 HIGH Priority (1 task, 2 weeks)

| ID | Task | Effort | Dependencies | Status |
|----|------|--------|--------------|--------|
| **P5.4** | DAG/WIH Integration | 2 weeks | P5.2.1 | ⏳ OPEN |

---

## Critical Path to MVP (12 weeks)

### Phase 1: Foundation (Weeks 1-4)
```
Week 1-2:  P4.16 - Agentation Integration
Week 3-4:  P4.17 - Storybook Evidence Lane
           P4.19 - Ontology Runtime Binding (parallel)
```

### Phase 2: Quality Gates (Weeks 5-8)
```
Week 5-6:  P4.20 - Evaluation Harness
           P4.23 - Purpose Binding (parallel)
Week 7-8:  P5.1.2 - Receipts Schema
           P5.1.3 - Policy Tier Gating (parallel)
```

### Phase 3: Browser Agent MVP (Weeks 9-12)
```
Week 9-10: P5.2.1 - ShellUI BrowserView Integration
Week 11:   P5.5 - Security Hardening
Week 12:   P5.4 - DAG/WIH Integration
```

---

## Deferred Tasks (13 weeks)

These are **NOT on critical path** and should be deferred until MVP complete:

| ID | Task | Effort | Reason for Deferral |
|----|------|--------|---------------------|
| **P4.1** | Swarm Scheduler Advanced | 2 weeks | Scaling feature, not core |
| **P4.2** | Policy Service | 2 weeks | Policy exists in harness |
| **P4.3** | Task Executor | 2 weeks | Execution exists |
| **P4.4** | Presentation Kernel | 1 week | UI layer, not blocking |
| **P4.5** | Directive Compiler | 2 weeks | Enhancement to planning |
| **P4.6** | IVKGE Advanced | 2 weeks | Visual features |
| **P4.7** | VPS Partnership | 1 week | Deployment optimization |
| **P4.9** | Multimodal Streaming | 3 weeks | Vision/audio, not core |
| **P4.11** | Tambo Integration | 2 weeks | UI generation, not core |
| **P4.13** | GC Agents | 1 week | Cleanup, not blocking |

---

## Tasks by Team

### Backend Team (9 tasks, 14 weeks)
- P4.19: Ontology Runtime Binding (2w)
- P4.20: Evaluation Harness (2w)
- P4.23: Purpose Binding (1w)
- P4.21: Checkpointing / Recovery (1w)
- P4.1: Swarm Scheduler Advanced (2w)
- P4.2: Policy Service (2w)
- P4.3: Task Executor (2w)
- P5.1.2: Receipts Schema (1w)
- P5.1.3: Policy Tier Gating (1w)

### Frontend Team (5 tasks, 7 weeks)
- P4.16: Agentation Integration (2w)
- P4.17: Storybook Evidence Lane (2w)
- P4.18: UI Contracts + Agent Roles (1w)
- P4.22: Observability Dashboard (2w)
- P5.2.1: ShellUI BrowserView (2w)

### Full Stack Team (2 tasks, 4 weeks)
- P4.4: Presentation Kernel (1w)
- P5.4: DAG/WIH Integration (2w)
- P4.11: Tambo Integration (2w)

### Security Team (1 task, 1 week)
- P5.5: Security Hardening (1w)

---

## Tasks by Dependency Chain

### Chain A: Agentation → Storybook → UI Contracts
```
P4.16 (Agentation)
    ↓
P4.17 (Storybook Evidence Lane)
    ↓
P4.18 (UI Contracts + Agent Roles)
```
**Total:** 5 weeks

### Chain B: Ontology → Evaluation → Observability
```
P4.19 (Ontology Runtime)
    ↓
P4.20 (Evaluation Harness)
    ↓
P4.22 (Observability Dashboard)
```
**Total:** 6 weeks

### Chain C: Browser Agent
```
P5.1.2 (Receipts Schema)
    ↓
P5.1.3 (Policy Tier Gating)
    ↓
P5.2.1 (ShellUI BrowserView)
    ↓
P5.4 (DAG/WIH Integration)
    ↓
P5.5 (Security Hardening)
```
**Total:** 7 weeks

### Chain D: Purpose Binding (Independent)
```
P4.23 (Purpose Binding)
```
**Total:** 1 week (can run parallel)

### Chain E: Deferred Swarm Advanced
```
P4.1 → P4.2 → P4.3 → P4.4 → P4.5 → P4.6 → P4.7
```
**Total:** 13 weeks (DEFERRED)

### Chain F: Deferred Enhancements
```
P4.9 (Multimodal)
P4.11 (Tambo)
P4.13 (GC Agents)
```
**Total:** 6 weeks (DEFERRED)

---

## Recommended Next Steps

### Immediate (Start This Week)
1. **P4.16: Agentation Integration** - Fork & absorb (2 weeks)
   - No dependencies
   - Quick win for dev productivity

### Week 3-4 (Start After P4.16)
2. **P4.17: Storybook Evidence Lane** (2 weeks)
   - Depends on P4.16
3. **P4.19: Ontology Runtime Binding** (2 weeks)
   - Independent, can run parallel

### Week 5-6
4. **P4.20: Evaluation Harness** (2 weeks)
   - Depends on P4.19
5. **P4.23: Purpose Binding** (1 week)
   - Independent, can run parallel

### Week 7-8
6. **P5.1.2: Receipts Schema** (1 week)
7. **P5.1.3: Policy Tier Gating** (1 week)
   - Can run parallel

### Week 9-12
8. **P5.2.1: ShellUI BrowserView** (2 weeks)
9. **P5.5: Security Hardening** (1 week)
10. **P5.4: DAG/WIH Integration** (2 weeks)

---

## Summary

**Total Open Tasks:** 19 tasks  
**Critical Path:** 12 weeks (10 tasks)  
**Deferred:** 13 weeks (10 tasks)  
**Total Effort:** 37 weeks (if all done)

**Recommended Focus:** Complete critical path (12 weeks) before starting deferred tasks.

---

**End of Open Tasks List**
