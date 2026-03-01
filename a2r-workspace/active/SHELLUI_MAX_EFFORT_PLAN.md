# SHELLUI INTEGRATION PLAN - MAXIMUM EFFORT

**Date:** 2026-02-22
**Goal:** Complete ShellUI integration for ALL DAG tasks with proper organization

---

## AUDIT FINDINGS

### Agentation Backend Status
**Status:** ❌ NO BACKEND - Frontend dev tool only
**Location:** `6-ui/a2r-platform/src/dev/agentation/`
**Purpose:** UI annotation tool for developers (like Storybook addon)
**Integration:** Should be in Storybook, NOT ShellUI production nav

---

## SHELLUI ORGANIZATION MAP

### Current Structure (rail.config.ts)
```
├── Core
│   ├── Home
│   ├── New LLM Chat (action)
│   ├── Elements Lab
│   └── Browser
├── Sessions & Projects (dynamic)
├── Agents
│   ├── Agent Studio
│   ├── Native Agent
│   ├── Agent System (Rails)
│   ├── Agent Registry
│   └── Memory
└── Services
    ├── Studio
    ├── Marketplace
    ├── OpenClaw Control Plane
    └── DAG Integration (my addition)
```

---

## PROPOSED ORGANIZATION FOR DAG TASKS

### Category 1: Infrastructure (NEW section)
```
├── Infrastructure
│   ├── Swarm Monitor (P4.1)
│   ├── Policy Manager (P4.2)
│   ├── Task Executor (P4.3)
│   └── Ontology Viewer (P4.19)
```

### Category 2: Development Tools (Expand Services)
```
├── Services
│   ├── ...existing...
│   ├── Directive Compiler (P4.5)
│   ├── Evaluation Harness (P4.20)
│   └── GC Agents (P4.13)
```

### Category 3: AI & Vision (NEW section)
```
├── AI & Vision
│   ├── IVKGE (P4.6)
│   ├── Multimodal (P4.9)
│   └── Tambo UI Gen (P4.11)
```

### Category 4: Security & Governance (NEW section)
```
├── Security & Governance
│   ├── Receipts (P5.1.2)
│   ├── Policy Gating (P5.1.3)
│   ├── Security (P5.5)
│   └── Purpose Binding (P4.23)
```

### Category 5: Browser & Execution (Expand Core or NEW)
```
├── Browser & Execution
│   ├── BrowserView (P5.2.1)
│   ├── DAG/WIH (P5.4)
│   └── Checkpointing (P4.21)
```

### Category 6: Observability (Standalone)
```
├── Observability
│   └── Dashboard (P4.22)
```

---

## INTEGRATION CHECKLIST

### Phase 1: ViewTypes (nav.types.ts) - 30 min
- [ ] Add 20 new ViewTypes
- [ ] Organize by category

### Phase 2: Navigation (rail.config.ts) - 30 min
- [ ] Add Infrastructure category
- [ ] Add AI & Vision category
- [ ] Add Security & Governance category
- [ ] Add Browser & Execution category
- [ ] Add Observability category
- [ ] Add 20+ navigation items

### Phase 3: View Registry (ShellApp.tsx) - 1 hour
- [ ] Import all view components
- [ ] Register 20+ views
- [ ] Add ErrorBoundaries

### Phase 4: Create Missing UI Components - 4-6 hours
- [ ] SwarmMonitor.tsx
- [ ] PolicyManager.tsx
- [ ] TaskExecutor.tsx
- [ ] OntologyViewer.tsx
- [ ] DirectiveCompiler.tsx
- [ ] EvaluationHarness.tsx
- [ ] GCAgents.tsx
- [ ] ReceiptsViewer.tsx
- [ ] PolicyGating.tsx
- [ ] SecurityDashboard.tsx
- [ ] PurposeBinding.tsx
- [ ] BrowserView.tsx (React wrapper for Rust engine)
- [ ] DAGWIH.tsx
- [ ] Checkpointing.tsx
- [ ] ObservabilityDashboard.tsx

### Phase 5: Testing - 2 hours
- [ ] Test all navigation items
- [ ] Verify all views render
- [ ] Test API connections

---

## PRIORITY ORDER

### CRITICAL (Do First)
1. BrowserView React wrapper (P5.2.1) - Core functionality
2. Swarm Monitor (P4.1) - Infrastructure monitoring
3. Observability Dashboard (P4.22) - System visibility
4. IVKGE standalone (P4.6) - Already exists, just register

### HIGH (Do Second)
5. Multimodal standalone (P4.9) - Already exists, just register
6. Tambo standalone (P4.11) - Already exists, just register
7. Policy Manager (P4.2) - Core governance
8. Receipts Viewer (P5.1.2) - Evidence management

### MEDIUM (Do Third)
9. Task Executor (P4.3)
10. Ontology Viewer (P4.19)
11. Evaluation Harness (P4.20)
12. Security Dashboard (P5.5)

### LOW (Do Last or Mark Backend-Only)
13. Directive Compiler (P4.5) - May be backend-only
14. GC Agents (P4.13) - May be backend-only
15. Purpose Binding (P4.23) - May be backend-only
16. Checkpointing (P4.21) - May be backend-only
17. DAG/WIH (P5.4) - May be backend-only
18. Policy Gating (P5.1.3) - May be backend-only

---

## STARTING NOW

**Beginning with Phase 1: ViewTypes**
