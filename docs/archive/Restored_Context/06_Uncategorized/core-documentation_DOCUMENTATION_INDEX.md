# Allternit Documentation Index

**Allternit Agentic OS - Complete Documentation Package**

---

## Quick Start

**If you're the next agent starting fresh:**

**For full 5-deliverable implementation:**
1. Read: `MASTER_HANDOFF_PROMPT.md` ⭐ (Complete mission spec)
2. Read: `MASTER_AGENT_AUDIT_AND_EXECUTION_PROMPT.md` (Audit directive)
3. Read: `AGENT_HANDOFF_PACKAGE.md` (context + quick reference)

**For general architecture understanding:**
1. Read: `MASTER_AGENT_AUDIT_AND_EXECUTION_PROMPT.md`
2. Read: `AGENT_HANDOFF_PACKAGE.md` (context + quick reference)
3. Start audit (PART 1 of master prompt)

**If you're returning to continue work:**

1. Check: `audit/A2_IMPLEMENTATION_PLAN.md` (phase progress)
2. Check: `AGENT_HANDOFF_PACKAGE.md` (known issues + file locations)
3. Resume from last completed phase

---

## Document Overview

### 0. MASTER_HANDOFF_PROMPT.md ⭐
**Complete 5-deliverable mission spec** - For full implementation of PTY brains, A2 CLI, OpenWork integration, UI-TARS tool, and capsule icons.

**Purpose:**
- Defines all 5 deliverables with acceptance criteria
- Expands PTY tool coverage (opencode, claude, codex, amp, goose, aider, qwen, gemini, cursor, verdant)
- Sets A2 CLI as top orchestrator
- Requires OpenWork fork integration (no stubs)
- Wires UI-TARS as real automation tool
- Mandates SVG icon pipeline (no emojis)

**Use when:**
- Starting complete implementation of all 5 deliverables
- Need expanded PTY tool coverage
- Building real UI-TARS automation loop

**Sections:**
- Mission statement
- Hard constraints (Electron only, no placeholder UI, no fake CLIs)
- Definition of Done
- DELIVERABLE 1/5: PTY Brain Wrappers (expanded list)
- DELIVERABLE 2/5: A2 CLI as "Top Process"
- DELIVERABLE 3/5: Fork OpenWork and Integrate as "Ops Center" Tab
- DELIVERABLE 4/5: UI-TARS Computer Use Tool (Real Automation Loop)
- DELIVERABLE 5/5: Capsule Icons + Vendor Asset Pipeline (No Emojis)
- Execution requirements (re-audit, small commits, demo checklist)
- Important notes (Amp, Codex, Gemini CLI)

---

### 1. MASTER_AGENT_AUDIT_AND_EXECUTION_PROMPT.md
**The definitive directive** - Give this verbatim to any agent working on Allternit.

**Purpose:**
- Forces audit before implementation
- Prohibits rebuilding existing infrastructure
- Requires visual deliverables
- Mandates concrete execution plan
- Sets clear success criteria

**Use when:**
- Handing off to a new agent
- Starting fresh implementation
- Clarifying system architecture

**Sections:**
- Role definition
- Core intent (architecture vision)
- PART 1: Audit (6 subsystems with questions)
- PART 2: Required conclusions (REUSE/EXTEND/BUILD)
- PART 3: Target architecture (diagrams)
- PART 4: Visual deliverables (4 required diagrams)
- PART 5: Execution plan (phased approach)
- Hard constraints (DO NOT / MUST)
- Success condition (7 criteria)
- Reference file locations

---

### 2. AGENT_HANDOFF_PACKAGE.md
**Complete context package** for the next agent.

**Purpose:**
- Explains what we've already done
- Summarizes target architecture
- Lists what needs to be built
- Provides quick start commands
- Lists known issues to fix

**Use when:**
- Agent needs context on previous work
- Looking for file locations
- Checking status of subsystems
- Understanding known issues

**Sections:**
- What we've already done (Phase 0 complete)
- Target architecture summary
- What needs to be built (4 critical gaps + 2 extensions)
- Visual deliverables required
- Success criteria (7 steps)
- Known issues (3 files with LSP errors)
- Quick start guide
- Important constraints
- File reference table
- What to do first

---

## Audit Deliverables (in `audit/` directory)

### 3. audit/A2_AUDIT_MAP.md
**Comprehensive inventory** with file/line evidence.

**Purpose:**
- Complete catalog of all subsystems
- File paths with exact line numbers
- Code snippets for key components
- "How to run" commands for each component
- Gap analysis with risk assessments

**Status:**
- 63% overall readiness
- 2 subsystems missing
- 2 subsystems partial
- 2 subsystems exist

**Sections:**
- Executive summary
- Subsystem 1: CLI / Daemon (17 commands, 18 ports)
- Subsystem 2: Brain Runtime (EventEnvelope, RunState, SSE)
- Subsystem 3: CLI Brains (CRITICAL GAP - no PTY wrappers)
- Subsystem 4: OpenWork (separate repo, needs integration)
- Subsystem 5: UI-TARS (skill exists, operator exists, needs execute)
- Subsystem 6: Shell UI (capsules exist, window behaviors incomplete)
- Gap summary table
- File reference index

---

### 4. audit/A2_REUSE_VS_BUILD.md
**Reuse vs build decision matrix** for each component.

**Purpose:**
- Decision matrix for 7 targets
- Effort estimates for each target
- File modification lists
- Reuse justification vs build justification

**Decisions:**
- 3 targets: ✅ REUSE (EventEnvelope, RunState, ToolGateway)
- 2 targets: 🔄 EXTEND (UI-TARS skill, Shell UI window behaviors)
- 2 targets: 🏗️ BUILD (CLI brain wrappers, Session HTTP API, GUI tools, OpenWork tab)

**Sections:**
- Target 1: CLI Brain Wrappers (BUILD, 3-5 days)
- Target 2: Session HTTP API (BUILD, 2-3 days)
- Target 3: OpenWork Tab Integration (BUILD, 1-2 days)
- Target 4: GUI Tools (BUILD, 1-2 days)
- Target 5: UI-TARS Execution Integration (EXTEND, 1-2 days)
- Target 6: Shell UI Window Behaviors (EXTEND, 1-2 days)
- Target 7: CLI ops Command (BUILD, 0.5 days)
- Effort summary: 15 days total (3 weeks)

---

### 5. audit/A2_IMPLEMENTATION_PLAN.md
**6-phase implementation path** with acceptance criteria.

**Purpose:**
- Phased delivery to manage risk
- Critical path: Phase 0 → 2 → 3 → 4 → 5
- Parallel work opportunities identified
- Detailed acceptance criteria per phase
- Exact files to create/modify

**Phases:**
- Phase 0: "Make it run" (2-4 hours) - Validate foundation
- Phase 1: A2 CLI ops command (0.5 days) - Ops entrypoint
- Phase 2: Session HTTP API + SSE (2-3 days) - Critical blocking dependency
- Phase 3: CLI Brain Subprocess Wrappers (3-5 days) - Connect CLIs
- Phase 4: OpenWork Tab Integration (1-2 days) - Embed OpenWork
- Phase 5: UI-TARS Execution Integration (1-2 days) - Full GUI control
- Phase 6: Consolidated Event Schema (2-3 days) - Final polish

**Total effort:** 15 days (3 weeks)

**Sections:**
- Implementation strategy
- Phase 0: Foundation validation (acceptance criteria, files)
- Phase 1: CLI ops command (acceptance criteria, files)
- Phase 2: Session API (acceptance criteria, files, dependencies)
- Phase 3: CLI brains (acceptance criteria, files, dependencies)
- Phase 4: OpenWork tab (acceptance criteria, files, dependencies)
- Phase 5: UI-TARS execution (acceptance criteria, files)
- Phase 6: Event schema (acceptance criteria, files)
- Parallel work opportunities
- Critical path visualization
- Risk mitigation

---

## Directory Structure

```
docs/
├── MASTER_HANDOFF_PROMPT.md                    # Complete 5-deliverable mission spec
├── MASTER_AGENT_AUDIT_AND_EXECUTION_PROMPT.md    # Definitive audit + execution directive
├── AGENT_HANDOFF_PACKAGE.md                     # Complete context package
├── DOCUMENTATION_INDEX.md                        # This file - complete index
├── README.md                                   # Directory organization
└── audit/
    ├── A2_AUDIT_MAP.md                          # Comprehensive inventory
    ├── A2_REUSE_VS_BUILD.md                     # Decision matrix
    └── A2_IMPLEMENTATION_PLAN.md                # 6-phase plan
```

---

## How to Use These Documents

### Scenario 0: New Agent - Full 5-Deliverable Implementation

```bash
# 1. Read the complete mission spec
cat docs/MASTER_HANDOFF_PROMPT.md

# 2. Re-audit the repo yourself (DO NOT trust prior summaries)
# Create: docs/audit/CLI_PTY_OPENWORK_UITARS_REAUDIT.md

# 3. Follow the 5 deliverables in order:
#    DELIVERABLE 1/5: PTY Brain Wrappers (expanded list)
#    DELIVERABLE 2/5: A2 CLI as "Top Process"
#    DELIVERABLE 3/5: Fork OpenWork and Integrate as "Ops Center" Tab
#    DELIVERABLE 4/5: UI-TARS Computer Use Tool (Real Automation Loop)
#    DELIVERABLE 5/5: Capsule Icons + Vendor Asset Pipeline (No Emojis)

# 4. Create demo checklist
# Create: docs/demo/CLI_PTY_OPENWORK_UITARS_DEMO.md
```

### Scenario 1: New Agent Starting Fresh (General Architecture Understanding)

# 2. Read the handoff package (for context)
cat docs/AGENT_HANDOFF_PACKAGE.md

# 3. Read audit reports (for existing knowledge)
cat docs/audit/A2_AUDIT_MAP.md
cat docs/audit/A2_REUSE_VS_BUILD.md
cat docs/audit/A2_IMPLEMENTATION_PLAN.md

# 4. Start audit (PART 1 of master prompt)
# Follow the questions in MASTER_AGENT_AUDIT_AND_EXECUTION_PROMPT.md
# Answer with file paths and line numbers
```

### Scenario 2: Continuing Implementation

```bash
# 1. Check implementation progress
cat docs/audit/A2_IMPLEMENTATION_PLAN.md
# Find the last completed phase

# 2. Check known issues
cat docs/AGENT_HANDOFF_PACKAGE.md
# Look for "Known Issues to Address" section

# 3. Reference file locations
cat docs/AGENT_HANDOFF_PACKAGE.md
# Look for "File Reference" table

# 4. Resume from next phase
# Follow the acceptance criteria in A2_IMPLEMENTATION_PLAN.md
```

### Scenario 3: Understanding Architecture

```bash
# 1. Read core intent
cat docs/MASTER_AGENT_AUDIT_AND_EXECUTION_PROMPT.md
# Skip to "CORE INTENT (READ CAREFULLY)" section

# 2. Review target architecture
cat docs/MASTER_AGENT_AUDIT_AND_EXECUTION_PROMPT.md
# Read "PART 3 — TARGET ARCHITECTURE"

# 3. Check subsystem status
cat docs/audit/A2_AUDIT_MAP.md
# Look for gap summary table

# 4. Understand build decisions
cat docs/audit/A2_REUSE_VS_BUILD.md
# Read decision matrix for each target
```

---

## Key Architecture Facts

### Root Process
- **CLI (`a2`)** is the top-level entrypoint
- `a2 up` starts all services (daemon, UI, operators)
- Everything else is subordinate to CLI

### Brain Runtime
- **EventEnvelope** (canonical event contract)
  - Location: `crates/kernel/kernel-contracts/src/lib.rs:7-46`
- **RunState** (session state machine)
  - Location: `crates/kernel/kernel-contracts/src/lib.rs:119-150`
- **ToolGateway** (tool registration/execution API)
  - Location: `crates/kernel/tools-gateway/src/lib.rs`

### OpenWork Integration
- OpenWork is **NOT** a brain
- OpenWork is a **GUI control plane** for sessions
- Must be embedded as a **tab** in Shell UI
- Connects via HTTP/SSE to `/v1/sessions` endpoints

### UI-TARS Integration
- UI-TARS is a **tool**, not a brain
- Never owns sessions
- Only executes GUI actions when invoked
- Needs 4 GUI tools: screenshot, click, type, scroll

### Shell UI
- Shell is the **visual OS** for capsules
- Capsules need OS window behaviors:
  - Minimize → Dock
  - Drag → TabStrip
  - Restore from tab
  - Reopen closed capsules
- Icons must be SVG, not emoji

---

## Critical Gaps (Must Build)

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| **CLI Brain Wrappers** | Blocks OpenCode/Claude/Gemini | 3-5 days | HIGH |
| **Session HTTP API** | Blocks external brain access | 2-3 days | HIGH |
| **OpenWork Tab** | No ops center in shell | 1-2 days | HIGH |
| **GUI Tools** | UI-TARS can't execute | 1-2 days | MEDIUM |

---

## Extensions Needed

| Component | Extension | Effort | Priority |
|-----------|-----------|--------|----------|
| **UI-TARS Skill** | Add `ui_tars.execute` | 1-2 days | MEDIUM |
| **Shell UI** | Window behaviors | 1-2 days | MEDIUM |

---

## Known Issues

1. **UI-TARS Operator** (`services/ui-tars-operator/src/main.py`)
   - Type annotation error (line 85)
   - Unbound variable (line 112)
   - **Priority:** HIGH (blocks UI-TARS execution)

2. **BrainManagerWidget** (`apps/shell/src/components/BrainManagerWidgetRedesigned.tsx`)
   - Missing `PRESET_RUNTIMES` constant
   - Duplicate variable declarations
   - **Priority:** MEDIUM (blocks runtime selection)

3. **App.tsx** (`apps/shell/src/App.tsx`)
   - Missing import for `capsule-spec`
   - **Priority:** LOW (type error only)

---

## Success Criteria

At the end of implementation, you should be able to:

1. ✅ Run `a2 up` → All services start successfully
2. ✅ Launch OpenWork → Appears as tab in Shell UI
3. ✅ Start session → Choose Claude/OpenCode, see it running
4. ✅ Watch live → Events stream in OpenWork UI
5. ✅ Click/type → UI-TARS executes GUI actions
6. ✅ Minimize/tab/restore → All window behaviors work
7. ✅ Find everything → Clear file organization

**If any of these fail, the implementation is incomplete.**

---

## Contact & Context

**Project:** Allternit Agentic OS
**Date:** 2026-01-18
**Status:** Audit complete, ready to begin implementation
**Next Step:** Execute Phase 0 validation (foundation)

**For questions about:**
- **Architecture:** Read MASTER_AGENT_AUDIT_AND_EXECUTION_PROMPT.md → PART 3
- **File locations:** Read AGENT_HANDOFF_PACKAGE.md → File Reference table
- **Implementation phases:** Read audit/A2_IMPLEMENTATION_PLAN.md
- **Subsystem status:** Read audit/A2_AUDIT_MAP.md

---

**End of Documentation Index**
