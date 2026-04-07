# Integration DAG Task List: Claude Code + Gizzi

**Project:** GIZZI Code (Claude Code base + Gizzi primitives)  
**Timeline:** 14 weeks  
**Dependencies:** Directed Acyclic Graph (DAG)

---

## DAG Structure Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PHASE 1: FOUNDATION                             │
│                             (Weeks 1-4)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ 1.1 Brand   │───→│ 1.2 Bus     │───→│ 1.3         │───→│ 1.4         │  │
│  │   Setup     │    │   System    │    │   Workspace │    │   Continuity│  │
│  │             │    │             │    │   Identity  │    │   Types     │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                  │                  │                  │          │
│         ↓                  ↓                  ↓                  ↓          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ 1.1.1-1.1.5 │    │ 1.2.1-1.2.4 │    │ 1.3.1-1.3.6 │    │ 1.4.1-1.4.4 │  │
│  │   Subtasks  │    │   Subtasks  │    │   Subtasks  │    │   Subtasks  │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PHASE 2: CONFIG & INSTRUCTIONS                     │
│                             (Weeks 5-7)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │ 2.1 Layered │───→│ 2.2 Auto-   │───→│ 2.3         │                     │
│  │   Config    │    │   Instruct  │    │   PermNext  │                     │
│  │             │    │             │    │   Rulesets  │                     │
│  └─────────────┘    └─────────────┘    └─────────────┘                     │
│         │                  │                  │                              │
│         ↓                  ↓                  ↓                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │ 2.1.1-2.1.5 │    │ 2.2.1-2.2.5 │    │ 2.3.1-2.3.4 │                     │
│  │   Subtasks  │    │   Subtasks  │    │   Subtasks  │                     │
│  └─────────────┘    └─────────────┘    └─────────────┘                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PHASE 3: ADVANCED FEATURES                          │
│                             (Weeks 8-11)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ 3.1         │───→│ 3.2         │───→│ 3.3         │───→│ 3.4 Session │  │
│  │   Verification│   │   Skills    │    │   Worktree  │    │   Tree      │  │
│  │   System    │    │   Enhance   │    │   Mgmt      │    │   Commands  │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                  │                  │                  │          │
│         ↓                  ↓                  ↓                  ↓          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ 3.1.1-3.1.6 │    │ 3.2.1-3.2.4 │    │ 3.3.1-3.3.4 │    │ 3.4.1-3.4.3 │  │
│  │   Subtasks  │    │   Subtasks  │    │   Subtasks  │    │   Subtasks  │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PHASE 4: POLISH                                 │
│                             (Weeks 12-14)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │ 4.1 LSP/    │───→│ 4.2         │───→│ 4.3         │                     │
│  │   Shell     │    │   Testing   │    │   Doc       │                     │
│  │   Enhance   │    │             │    │             │                     │
│  └─────────────┘    └─────────────┘    └─────────────┘                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## PHASE 1: FOUNDATION (Weeks 1-4)

### Task 1.1: Gizzi Branding Setup
**Duration:** 1 week  
**Dependencies:** None (can start immediately)

| Subtask | ID | Description | Effort | Dependencies |
|---------|-----|-------------|--------|--------------|
| 1.1.1 | Create brand constants | Create `src/brand/meta.ts` with GIZZIBrand constants | 2h | None |
| 1.1.2 | Port GIZZICopy strings | Port all user-facing strings from Gizzi | 4h | 1.1.1 |
| 1.1.3 | Reimplement ShimmeringBanner | Create Ink-based boot animation | 8h | 1.1.1 |
| 1.1.4 | Replace Claude strings | Find/replace "Claude" → "GIZZI" in components | 6h | 1.1.2 |
| 1.1.5 | Update CLI entry | Rename command to `gizzi-code` | 2h | 1.1.1 |

**Deliverable:** Product boots as "GIZZI Code" with proper branding

---

### Task 1.2: Bus Event System
**Duration:** 1 week  
**Dependencies:** None

| Subtask | ID | Description | Effort | Dependencies |
|---------|-----|-------------|--------|--------------|
| 1.2.1 | Create Bus namespace | Implement publish/subscribe/once | 4h | None |
| 1.2.2 | Add type safety | Create BusEventDefinition types | 3h | 1.2.1 |
| 1.2.3 | Bridge to AppState | Connect Bus to Claude's state changes | 6h | 1.2.1 |
| 1.2.4 | Add global subscriber | Implement subscribeAll for telemetry | 2h | 1.2.1 |

**Deliverable:** Event bus operational, bridged to existing state

---

### Task 1.3: Workspace Identity System
**Duration:** 1.5 weeks  
**Dependencies:** 1.1 (Branding)

| Subtask | ID | Description | Effort | Dependencies |
|---------|-----|-------------|--------|--------------|
| 1.3.1 | Create workspace types | Define Workspace.Info, Config types | 3h | None |
| 1.3.2 | Implement init function | Create `.gizzi/` directory with starter files | 6h | 1.3.1 |
| 1.3.3 | Create IDENTITY.md template | Name, emoji, vibe configuration | 2h | 1.3.2 |
| 1.3.4 | Create SOUL.md template | Personality, behavioral guidelines | 4h | 1.3.2 |
| 1.3.5 | Create USER.md template | User context, preferences | 2h | 1.3.2 |
| 1.3.6 | Create MEMORY.md template | Long-term memory structure | 3h | 1.3.2 |
| 1.3.7 | Add `/workspace init` command | CLI command for workspace creation | 4h | 1.3.1-1.3.6 |
| 1.3.8 | Add layered format support | L1-L5 directory structure | 6h | 1.3.1 |

**Deliverable:** `.gizzi/` workspace system functional

---

### Task 1.4: Continuity/Handoff Types
**Duration:** 0.5 weeks  
**Dependencies:** None

| Subtask | ID | Description | Effort | Dependencies |
|---------|-----|-------------|--------|--------------|
| 1.4.1 | Define SessionContext type | Tool-agnostic context structure | 3h | None |
| 1.4.2 | Define DAGTask type | Task tracking with dependencies | 2h | 1.4.1 |
| 1.4.3 | Define GIZZIConventions | Project-specific standards | 2h | 1.4.1 |
| 1.4.4 | Create handoff types | Bundle format for transfer | 2h | 1.4.1-1.4.3 |

**Deliverable:** Type definitions for continuity system

---

## PHASE 2: CONFIG & INSTRUCTIONS (Weeks 5-7)

### Task 2.1: Layered Configuration
**Duration:** 1 week  
**Dependencies:** 1.2 (Bus)

| Subtask | ID | Description | Effort | Dependencies |
|---------|-----|-------------|--------|--------------|
| 2.1.1 | Enhance config loading | Add JSONC support | 4h | None |
| 2.1.2 | Add .well-known loading | Fetch remote org config | 6h | 2.1.1 |
| 2.1.3 | Implement array merging | Concatenate arrays on merge | 3h | 2.1.1 |
| 2.1.4 | Add config precedence | 6-layer loading order | 6h | 2.1.1-2.1.3 |
| 2.1.5 | Add config validation | Zod schemas for validation | 4h | 2.1.1 |

**Deliverable:** Advanced configuration system

---

### Task 2.2: Auto-Loading Instructions
**Duration:** 1 week  
**Dependencies:** 1.3 (Workspace)

| Subtask | ID | Description | Effort | Dependencies |
|---------|-----|-------------|--------|--------------|
| 2.2.1 | Create instruction scanner | Discover AGENTS.md, CLAUDE.md | 4h | None |
| 2.2.2 | Add .gizzi file loading | Load IDENTITY, SOUL, USER, MEMORY | 4h | 2.2.1 |
| 2.2.3 | Implement relevance scoring | Match session title to topics | 6h | 2.2.1 |
| 2.2.4 | Add topic memory discovery | Find *.md in memory directories | 4h | 2.2.1 |
| 2.2.5 | Add truncation logic | Max 200 lines per file | 3h | 2.2.1-2.2.4 |

**Deliverable:** Automatic instruction loading with relevance

---

### Task 2.3: PermissionNext Rulesets
**Duration:** 0.5 weeks  
**Dependencies:** None

| Subtask | ID | Description | Effort | Dependencies |
|---------|-----|-------------|--------|--------------|
| 2.3.1 | Create Ruleset types | Type definitions for permissions | 2h | None |
| 2.3.2 | Implement merge function | Deep merge of rulesets | 3h | 2.3.1 |
| 2.3.3 | Add wildcard matching | Pattern matching for paths | 4h | 2.3.1 |
| 2.3.4 | Integrate with permission system | Use rulesets in tool permission | 6h | 2.3.1-2.3.3 |

**Deliverable:** Ruleset-based permissions working

---

## PHASE 3: ADVANCED FEATURES (Weeks 8-11)

### Task 3.1: Advanced Verification System
**Duration:** 2 weeks  
**Dependencies:** 1.2 (Bus), 1.4 (Continuity)

| Subtask | ID | Description | Effort | Dependencies |
|---------|-----|-------------|--------|--------------|
| 3.1.1 | Create verification types | Certificate, Trace, Premise types | 4h | 1.4 |
| 3.1.2 | Implement Verifier | Empirical verification (run tests) | 8h | 3.1.1 |
| 3.1.3 | Implement SemiFormalVerifier | Reasoning-based verification | 12h | 3.1.1 |
| 3.1.4 | Create orchestrator | Coordinate empirical + semi-formal | 8h | 3.1.2, 3.1.3 |
| 3.1.5 | Add visual evidence capture | Screenshots, coverage maps | 10h | 3.1.4 |
| 3.1.6 | Add `/verify` command | User-facing verification command | 6h | 3.1.4-3.1.5 |

**Deliverable:** Full verification system operational

---

### Task 3.2: Skills System Enhancement
**Duration:** 1 week  
**Dependencies:** 2.1 (Config)

| Subtask | ID | Description | Effort | Dependencies |
|---------|-----|-------------|--------|--------------|
| 3.2.1 | Add external dir scanning | Scan .agents, .openclaw directories | 6h | None |
| 3.2.2 | Port skill creator | AI-powered skill generation | 10h | 3.2.1 |
| 3.2.3 | Port skill evaluator | Test and validate skills | 8h | 3.2.2 |
| 3.2.4 | Add skill marketplace integration | Browse/install community skills | 8h | 3.2.1 |

**Deliverable:** Enhanced skills system

---

### Task 3.3: Git Worktree Management
**Duration:** 0.5 weeks  
**Dependencies:** None

| Subtask | ID | Description | Effort | Dependencies |
|---------|-----|-------------|--------|--------------|
| 3.3.1 | Create worktree types | Info, CreateInput, Errors | 2h | None |
| 3.3.2 | Implement name generator | Random adjective-noun names | 3h | 3.3.1 |
| 3.3.3 | Add create function | Git worktree creation | 4h | 3.3.2 |
| 3.3.4 | Add `/worktree` command | CLI for worktree management | 4h | 3.3.3 |

**Deliverable:** Worktree management commands

---

### Task 3.4: Session Tree Commands
**Duration:** 0.5 weeks  
**Dependencies:** None (uses Claude's existing fork)

| Subtask | ID | Description | Effort | Dependencies |
|---------|-----|-------------|--------|--------------|
| 3.4.1 | Add parent/child fields | Extend session storage | 4h | None |
| 3.4.2 | Add `/tree` command | Visualize session tree | 6h | 3.4.1 |
| 3.4.3 | Add `/parent` command | Navigate to parent session | 3h | 3.4.1 |
| 3.4.4 | Add continuity context | Store handoff data in session | 4h | 1.4, 3.4.1 |

**Deliverable:** Session tree navigation

---

## PHASE 4: POLISH (Weeks 12-14)

### Task 4.1: LSP/Shell Enhancements
**Duration:** 1 week  
**Dependencies:** None

| Subtask | ID | Description | Effort | Dependencies |
|---------|-----|-------------|--------|--------------|
| 4.1.1 | Port LSP runtime | Better LSP server management | 8h | None |
| 4.1.2 | Add completion integration | Show completions in context | 6h | 4.1.1 |
| 4.1.3 | Port PTY shell | Interactive terminal support | 10h | None |
| 4.1.4 | Add shell state preservation | Maintain shell context | 6h | 4.1.3 |

**Deliverable:** Enhanced LSP and shell

---

### Task 4.2: Integration Testing
**Duration:** 1 week  
**Dependencies:** All previous tasks

| Subtask | ID | Description | Effort | Dependencies |
|---------|-----|-------------|--------|--------------|
| 4.2.1 | Write Bus tests | Event pub/sub testing | 6h | 1.2 |
| 4.2.2 | Write workspace tests | .gizzi/ initialization tests | 6h | 1.3 |
| 4.2.3 | Write continuity tests | Handoff/transfer tests | 8h | 1.4, 3.4 |
| 4.2.4 | Write verification tests | Certificate generation tests | 8h | 3.1 |
| 4.2.5 | Integration test suite | End-to-end workflows | 12h | All |

**Deliverable:** Test coverage >80%

---

### Task 4.3: Documentation
**Duration:** 0.5 weeks  
**Dependencies:** All previous tasks

| Subtask | ID | Description | Effort | Dependencies |
|---------|-----|-------------|--------|--------------|
| 4.3.1 | Write setup guide | Installation and configuration | 4h | All |
| 4.3.2 | Write workspace guide | .gizzi/ setup and usage | 4h | 1.3 |
| 4.3.3 | Write verification guide | How to use verification | 4h | 3.1 |
| 4.3.4 | Write migration guide | Claude → GIZZI migration | 4h | All |
| 4.3.5 | API documentation | Code documentation | 8h | All |

**Deliverable:** Complete documentation

---

## PHASE 5: COWORK (Post-Stability)

### Task 5.1: Cowork Mode
**Duration:** 3-4 weeks  
**Dependencies:** Phase 1-4 complete, system stable

| Subtask | ID | Description | Effort | Dependencies |
|---------|-----|-------------|--------|--------------|
| 5.1.1 | Design cowork protocol | API and message formats | 8h | None |
| 5.1.2 | Implement cowork runtime | Persistent session daemon | 20h | 5.1.1 |
| 5.1.3 | Add approval system | Human-in-the-loop approvals | 16h | 5.1.2 |
| 5.1.4 | Add checkpoint system | Save/restore session state | 16h | 5.1.2 |
| 5.1.5 | Add `/cowork` command | CLI for cowork management | 8h | 5.1.1-5.1.4 |
| 5.1.6 | Add sharing system | Share sessions with team | 12h | 5.1.2 |

**Deliverable:** Full cowork mode

---

## Task Summary by Category

| Category | Tasks | Effort (hours) | Weeks |
|----------|-------|----------------|-------|
| **Branding** | 1.1 | 22 | 1 |
| **Core Arch** | 1.2, 1.4 | 24 | 1.5 |
| **Workspace** | 1.3 | 30 | 1.5 |
| **Config** | 2.1 | 23 | 1 |
| **Instructions** | 2.2 | 21 | 1 |
| **Permissions** | 2.3 | 15 | 0.5 |
| **Verification** | 3.1 | 48 | 2 |
| **Skills** | 3.2 | 32 | 1 |
| **Worktree** | 3.3 | 13 | 0.5 |
| **Session** | 3.4 | 17 | 0.5 |
| **Integrations** | 4.1 | 30 | 1 |
| **Testing** | 4.2 | 40 | 1 |
| **Docs** | 4.3 | 24 | 0.5 |
| **TOTAL** | | **339** | **14** |

---

## Critical Path

```
Week 1:  1.1 (Branding) ──────────────────────────────────────────┐
         1.2 (Bus) ──────────────────────────────────────────────┤
Week 2:  1.3 (Workspace) ─────────────────────────────────────────┤
         1.4 (Continuity) ─────────────────────────────────────────┤
Week 3:  2.1 (Config) ────────────────────────────────────────────┤
Week 4:  2.2 (Instructions) ──────────────────────────────────────┤
Week 5:  2.3 (Permissions) ───────────────────────────────────────┤
Week 6:  3.1.1-3.1.3 (Verification types + verifiers) ────────────┤
Week 7:  3.1.4-3.1.6 (Orchestrator + UI) ─────────────────────────┤
Week 8:  3.2 (Skills) ────────────────────────────────────────────┤
Week 9:  3.3 (Worktree) + 3.4 (Session Tree) ─────────────────────┤
Week 10: 4.1 (LSP/Shell) ─────────────────────────────────────────┤
Week 11: 4.2 (Testing) ───────────────────────────────────────────┤
Week 12: 4.2 (Testing cont.) ─────────────────────────────────────┤
Week 13: 4.3 (Docs) ──────────────────────────────────────────────┤
Week 14: Buffer / Polish / Release Prep ──────────────────────────┘
```

---

## Deliverables by Phase

| Phase | Deliverables | Success Criteria |
|-------|--------------|------------------|
| **1** | Branded base, Bus, Workspace, Continuity types | Product boots as GIZZI, events work, .gizzi/ creates |
| **2** | Layered config, Auto-instructions, PermissionNext | Config loads from multiple sources, instructions auto-load |
| **3** | Verification, Skills, Worktree, Session tree | /verify works, skills enhanced, tree navigation works |
| **4** | LSP/Shell enhanced, Tests, Docs | >80% coverage, docs complete |
| **5** | Cowork mode | Persistent sessions, approvals, sharing |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Verification complexity | Start with empirical only, add semi-formal later |
| Workspace conflicts | Maintain backward compat with .claude/ |
| Bus performance | Profile early, optimize if needed |
| Testing overhead | Write tests alongside features |

---

*DAG task list complete. Ready for project execution.*
