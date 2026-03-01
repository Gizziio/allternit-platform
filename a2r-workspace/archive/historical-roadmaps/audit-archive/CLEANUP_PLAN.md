# Workspace Cleanup & Reorganization Plan

**Last Updated:** 2026-01-18
**Status:** 🔄 In Progress
**Priority:** High

## Problem Statement

The `~/Desktop/a2rchitech-workspace` directory contains 4 major projects mixed together with no clear separation, resulting in:
- 119+ markdown files scattered at root level
- Multiple independent projects (A2rchitech, AlphaTrader, Project Gizzi, Architecture) in one folder
- No clear workspace boundaries or navigation
- Duplicate documentation and status reports
- No centralized configuration or tooling

## Proposed Structure

### Before (Current)
```
a2rchitech-workspace/
├── a2rchitech/              # 119+ markdown files mixed in
├── Project Gizzi/            # 6 sub-projects
├── alpha-trader/            # Standalone trading bot
├── Architecture/             # Documentation only
├── A2rchitech_Current_State.md
├── META-ORCHESTRATED SPEC-DRIVEN AGENTIC FRAMEWORK.md
├── MARKETPLACE_TUI_DEMO.md
└── [115+ more markdown files...]
```

### After (Proposed)
```
a2rchitech-workspace/
├── README.md                # ✅ Workspace overview (created)
├── CLEANUP_PLAN.md          # ✅ This file
├── a2rchitech/            # Main project
│   ├── README.md           # Project-specific docs
│   ├── docs/              # Consolidated docs
│   ├── services/          # Existing
│   ├── crates/            # Existing
│   ├── packages/          # Existing
│   └── apps/             # Existing
├── alpha-trader/          # Trading system (keep separate)
│   ├── README.md
│   ├── docs/
│   └── [existing structure]
├── project-gizzi/         # Renamed from "Project Gizzi"
│   ├── README.md
│   ├── gizzi-legacy/
│   ├── gizzi-runtime/
│   ├── gizzi-sdk/
│   ├── gizzi-mc2/
│   ├── gizziio-code/
│   └── gizzi-docs/
└── archive/               # Historical/deleted items
    ├── a2rchitech-specs(temporary)/
    └── Research Docs/
```

---

## Phase 1: Quick Wins (1-2 hours) ✅ STARTED

### 1.1 Create Workspace Documentation
- [x] Create workspace README.md ✅
- [x] Create CLEANUP_PLAN.md ✅
- [ ] Create CONTRIBUTING.md
- [ ] Create .env.example template for each project

### 1.2 Consolidate Documentation
- [ ] Move 119+ markdown files into project-specific `docs/` folders:
  - `a2rchitech/*.md` → `a2rchitech/docs/`
  - Keep only essential docs at root (README.md, CLEANUP_PLAN.md)
- [ ] Identify and remove duplicate files
- [ ] Create documentation index for each project

### 1.3 Clean Build Artifacts
- [ ] Verify `.gitignore` is complete for all projects
- [ ] Remove `node_modules/`, `target/`, `__pycache__/` from tracking
- [ ] Clean up log files (or move to `logs/`)

---

## Phase 2: Moderate Restructure (4-6 hours)

### 2.1 Standardize Configuration
- [ ] Create `config/` structure for each project:
  ```
  a2rchitech/
  ├── .env.example
  └── config/
      ├── development.env
      ├── production.env
      └── secrets.env (gitignored)
  ```
- [ ] Consolidate environment variable documentation
- [ ] Add secrets management guide

### 2.2 Improve Project Separation
- [ ] Rename `Project Gizzi` → `project-gizzi` (kebab-case)
- [ ] Create README.md for each sub-project in project-gizzi/
- [ ] Archive non-active projects:
  - Move `a2rchitech-specs(temporary)/` → `archive/`
  - Move `Research Docs/` → `archive/`

### 2.3 Standardize Tooling
- [ ] Add workspace-level Makefile:
  ```makefile
  help:      # Show all commands
  dev-all:   # Start all active projects
  test-all:   # Run all tests
  clean-all:  # Clean all build artifacts
  ```
- [ ] Add pre-commit hooks (if Git repo)
- [ ] Create development onboarding guide

### 2.4 Consolidate Architecture Docs
- [ ] Merge `Architecture/` into project-specific `docs/` folders
- [ ] Create unified architecture overview
- [ ] Backlog: Move `Architecture/BACKLOG/` → issue tracker (Beads)

---

## Phase 3: Comprehensive Overhaul (1-2 days) - OPTIONAL

### 3.1 Monorepo Migration
- [ ] Evaluate monorepo tools: Nx, Turbo, Cargo Workspace
- [ ] Implement single build/test/lint pipeline
- [ ] Create shared tooling (linters, formatters, CI)

### 3.2 AlphaTrader Integration
- [ ] Port AlphaTrader to A2rchitech patterns
- [ ] Use A2rchitech Kernel for orchestration
- [ ] Migrate YAML workflows to A2rchitech schema
- [ ] Integrate with A2A Gateway

### 3.3 Observability Standardization
- [ ] Unified logging across all services
- [ ] Metrics collection (Prometheus)
- [ ] Tracing (OpenTelemetry)
- [ ] Centralized log aggregation

### 3.4 Service Discovery
- [ ] Implement environment-based service URLs (no hardcoding)
- [ ] Add health checks to all services
- [ ] Create service registry (A2A Gateway)

### 3.5 Documentation Platform
- [ ] Set up documentation site (Docusaurus, MkDocs)
- [ ] Auto-generate API docs from Rust/TypeScript
- [ ] Interactive tutorials and examples

---

## Project-Specific Actions

### A2rchitech
- [ ] Move root-level markdown files to `a2rchitech/docs/`
- [ ] Create `a2rchitech/docs/SUMMARY.md` index
- [ ] Consolidate completion reports
- [ ] Archive phase-specific docs (Phase_1_*, Phase_2_*, etc.)

### AlphaTrader
- [ ] Keep standalone (working well as-is)
- [ ] Create `alpha-trader/docs/` for existing markdown
- [ ] Add `alpha-trader/.env.example`
- [ ] Document integration path to A2rchitect

### Project Gizzi
- [ ] Rename folder to `project-gizzi`
- [ ] Assess each sub-project status:
  - Active → Keep in main workspace
  - Paused → Move to `archive/`
  - Ready → Activate and integrate
- [ ] Create unified README

### Architecture
- [ ] Distribute docs to relevant projects:
  - Backlog → Beads issue tracker
  - UI specs → A2rchitect/`apps/shell/docs/`
  - Integrations → Service-specific docs
- [ ] Archive folder when done

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Breaking existing workflows | Low | High | Test changes in branch first |
| Losing important documentation | Medium | High | Create backup before moving files |
| Merge conflicts if Git repo | Low | Medium | Coordinate with team |
| Service discovery breaks | Low | High | Update all hardcoded URLs last |

---

## Success Criteria

- ✅ Clear separation between projects
- ✅ Root directory has only essential files (< 10)
- ✅ Each project has its own `docs/` folder
- ✅ Workspace README provides clear navigation
- ✅ No duplicate documentation files
- ✅ Build artifacts properly ignored
- ✅ Environment variables documented in `.env.example`

---

## Questions for Decision Makers

1. **Monorepo vs Multi-repo:**
   - Keep as single workspace (current)?
   - Split into separate Git repos (A2rchitect, AlphaTrader, Gizzi)?

2. **Project Gizzi:**
   - Archive all of it?
   - Keep active parts?
   - Resume development?

3. **AlphaTrader Integration:**
   - Keep standalone?
   - Integrate with A2rchitect Kernel (effort: 1-2 weeks)?

4. **Tooling Investment:**
   - Keep minimal (current)?
   - Add comprehensive tooling (Nx/Turbo, etc.)?

---

## Timeline Estimate

| Phase | Effort | Blocking | Completion Target |
|-------|--------|----------|------------------|
| Phase 1: Quick Wins | 1-2 hours | None | Today |
| Phase 2: Moderate Restructure | 4-6 hours | Phase 1 complete | This week |
| Phase 3: Comprehensive Overhaul | 1-2 days | Phase 2 complete | Next sprint |

---

## References

- Workspace overview: `README.md`
- A2rchitech docs: `a2rchitech/README.md`
- AlphaTrader docs: `alpha-trader/DESIGN.md`
- Current state analysis: `A2rchitech_Current_State.md`
- Service architecture: `a2rchitech/COMPLETE.md`

---

**Next Steps:**
1. Review this plan with team
2. Approve Phase 1 scope
3. Execute Phase 1 (Quick Wins)
4. Review results before Phase 2
