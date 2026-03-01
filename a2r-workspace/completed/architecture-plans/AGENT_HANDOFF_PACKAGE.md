# A2rchitech Agent Handoff Package

**Date:** 2026-01-18
**Purpose:** Complete briefing for the next agent to finish the A2rchitech Agentic OS

---

## What This Package Contains

### 1. MASTER_AGENT_AUDIT_AND_EXECUTION_PROMPT.md
**The definitive prompt** to give verbatim to the next agent.

This is not a "how-to" guide. It's a directive that:
- Forces the agent to audit before building
- Prohibits rebuilding existing infrastructure
- Requires visual deliverables (diagrams, specs)
- Mandates a concrete execution plan
- Sets clear success criteria

**Give this file to the next agent, and they will:**
1. Understand the codebase architecture
2. Know what exists vs what's missing
3. Build only the necessary glue
4. Deliver visual specifications
5. Follow a phased implementation plan

---

## Context for the Next Agent

### What We've Already Done

**Phase 0: Audit & Planning (COMPLETED)**
- ✅ Identified repo structure and workspace tooling
- ✅ Found all 6 subsystems (CLI, Daemon, Brain, OpenWork, UI-TARS, Shell)
- ✅ Verified OpenWork installation at `~/Desktop/openwork/`
- ✅ Verified UI-TARS installation (both fork and original)
- ✅ Generated comprehensive audit reports in `docs/audit/`

**Existing Audit Deliverables (Reference):**
- `docs/audit/A2_AUDIT_MAP.md` - Complete inventory with file/line evidence
- `docs/audit/A2_REUSE_VS_BUILD.md` - Reuse vs build decision matrix
- `docs/audit/A2_IMPLEMENTATION_PLAN.md` - 6-phase implementation path

**Status:** All research done. Ready to build.

---

## Target Architecture Summary

```
a2 (CLI, top process)
│
├── daemon (lifecycle + IO, port 3000)
│
├── brain sessions (HTTP + SSE)
│   ├── OpenCode (PTY subprocess)
│   ├── Claude Code (PTY subprocess)
│   ├── Gemini (PTY subprocess)
│
├── tools
│   ├── bash / git / fs
│   └── ui-tars (GUI control)
│
└── services
    ├── ui-tars operator (FastAPI, port 3008)
    └── tool gateway
```

**Key points:**
- CLI is the root → `a2 up` starts everything
- Brains are subprocesses, not services
- OpenWork is embedded as a Shell tab, not standalone
- UI-TARS is a tool, not a brain

---

## What Needs to Be Built

### Critical Gaps (BUILD, not reuse)

1. **CLI Brain Wrappers** (`🏗️ BUILD`)
   - PTY-based subprocess drivers
   - OpenCode adapter
   - Claude Code adapter
   - Gemini adapter
   - **Location:** `crates/brain/src/lib.rs` or similar

2. **Session HTTP API** (`🏗️ BUILD`)
   - `/v1/sessions` endpoints (GET, POST, DELETE)
   - `/v1/sessions/{id}/events` (SSE)
   - `/v1/sessions/{id}/commands` (HTTP POST)
   - **Location:** `services/kernel/src/api/sessions.rs` (new file)

3. **OpenWork Tab Integration** (`🏗️ BUILD`)
   - Add `ViewMode::OpenWork` to LeftRail
   - Create OpenWorkView component (iframe embed)
   - Wire event streams to OpenWork UI
   - **Location:** `apps/shell/src/components/OpenWorkView.tsx` (new)

4. **GUI Tools** (`🏗️ BUILD`)
   - `gui.screenshot` (capture screen)
   - `gui.click` (execute click)
   - `gui.type` (type text)
   - `gui.scroll` (scroll viewport)
   - **Location:** `crates/tools/src/gui.rs` (new)

### Extensions Needed (`🔄 EXTEND`)

1. **UI-TARS Skill** (`🔄 EXTEND`)
   - Add `ui_tars.execute` method (currently only has `propose`)
   - Wire execution loop: screenshot → propose → execute → verify
   - **Location:** `crates/skills/src/ui_tars/mod.rs`

2. **Shell UI Window Behavior** (`🔄 EXTEND`)
   - Implement minimize → dock
   - Implement drag → tab strip
   - Implement restore from tab
   - Add SVG icon system
   - **Location:** `apps/shell/src/components/` and `apps/shell/src/stores/`

---

## Visual Deliverables Required

The next agent must produce:

1. **Shell UI Layout Diagram** (ASCII/SVG)
   - Left rail, content area, tab strip, dock, top bar

2. **Capsule Lifecycle Diagram** (state machine)
   - State transitions: Creating → Normal → Minimized → Dock → Closed → Reopen

3. **CLI ↔ OpenWork ↔ UI-TARS Flow Diagram**
   - Data flow: CLI Daemon → Session API → OpenWork UI → Tool Gateway → UI-TARS → GUI Tools

4. **Icon System Specification**
   - Naming convention
   - Folder structure
   - Generation rules
   - Fallback behavior

---

## Success Criteria

At the end, you should be able to:

1. ✅ Run `a2 up` → All services start
2. ✅ Launch OpenWork → Appears as tab in Shell
3. ✅ Start session → Choose Claude/OpenCode
4. ✅ Watch live → Events stream in OpenWork UI
5. ✅ Click/type → UI-TARS executes GUI actions
6. ✅ Minimize/tab/restore → All window behaviors work
7. ✅ Find everything → Clear file organization

---

## Known Issues to Address

### UI-TARS Operator
```
ERROR [85:12] Type "str | None" is not assignable to return type "str"
ERROR [112:26] "parse_action_to_structure_output" is possibly unbound
```
**Location:** `services/ui-tars-operator/src/main.py`
**Fix:** Type annotation fix, import fix

### BrainManagerWidget
```
ERROR [175:25] Cannot find name 'PRESET_RUNTIMES'
ERROR [88:9] Cannot redeclare block-scoped variable 'getStatusStyle'
```
**Location:** `apps/shell/src/components/BrainManagerWidgetRedesigned.tsx`
**Fix:** Define PRESET_RUNTIMES, remove duplicate variable declarations

### App.tsx
```
ERROR [43:49] Cannot find module '../../types/capsule-spec'
```
**Location:** `apps/shell/src/App.tsx`
**Fix:** Create missing type definitions or fix import path

---

## Quick Start for Next Agent

```bash
# 1. Read the master prompt
cd ~/Desktop/a2rchitech-workspace/a2rchitech
cat docs/MASTER_AGENT_AUDIT_AND_EXECUTION_PROMPT.md

# 2. Start the audit (PART 1 of the prompt)
# Answer all questions with file paths and line numbers

# 3. Produce the audit report
# Include all 6 subsystems with evidence

# 4. Classify subsystems (PART 2)
# REUSE / EXTEND / BUILD with justifications

# 5. Align with architecture (PART 3)
# Verify CLI is root, OpenWork is embedded, UI-TARS is a tool

# 6. Produce visual deliverables (PART 4)
# Layout diagram, lifecycle diagram, flow diagram, icon spec

# 7. Create execution plan (PART 5)
# Max 6 phases, acceptance criteria, exact file lists

# 8. Execute phases in order
# Phase 0 (validation) → Phase 1 (CLI brains) → Phase 2 (Session API) → etc.
```

---

## Important Constraints

### DO NOT
- ❌ Rebuild what already exists (EventEnvelope, RunState, ToolGateway)
- ❌ Use emoji icons (use SVG assets)
- ❌ Create fake demos (end-to-end functionality required)
- ❌ Add Tauri (already removed)
- ❌ Make OpenWork standalone (must be embedded in Shell)

### MUST
- ✅ Audit before building (PART 1 of the prompt is mandatory)
- ✅ Reuse existing contracts (kernel-contracts, tools-gateway)
- ✅ Use PTY for CLI brain subprocesses
- ✅ Integrate OpenWork as Shell tab via iframe
- ✅ Wire UI-TARS as tool, not brain

---

## File Reference

| Subsystem | Location | Status |
|-----------|----------|--------|
| **CLI** | `apps/cli/src/main.rs` | ✅ Exists, 17 commands |
| **Daemon** | `apps/cli/src/commands/daemon.rs` | ✅ Exists, manages ports |
| **EventEnvelope** | `crates/kernel/kernel-contracts/src/lib.rs:7-46` | ✅ Canonical event schema |
| **RunState** | `crates/kernel/kernel-contracts/src/lib.rs:119-150` | ✅ State machine |
| **ToolGateway** | `crates/kernel/tools-gateway/src/lib.rs` | ✅ Full API |
| **UI-TARS Skill** | `crates/skills/src/ui_tars/mod.rs` | ⚠️ Extend, add execute |
| **UI-TARS Operator** | `services/ui-tars-operator/src/main.py` | ⚠️ Fix LSP errors |
| **Shell UI** | `apps/shell/src/` | ⚠️ Extend window behaviors |
| **OpenWork** | `~/Desktop/openwork/` | ✅ Installed, needs integration |
| **CLI Brain Wrappers** | `crates/brain/src/` | ❌ Missing |
| **Session API** | `services/kernel/src/api/` | ❌ Missing |
| **GUI Tools** | `crates/tools/src/` | ❌ Missing |

---

## What the Next Agent Should Do First

1. **Read the master prompt** (MASTER_AGENT_AUDIT_AND_EXECUTION_PROMPT.md)
2. **Start PART 1** - Audit CLI/Daemon subsystem
3. **Answer all questions** with file paths and line numbers
4. **Continue PART 1** - Audit all 6 subsystems
5. **Produce audit report** before writing any code
6. **Follow the prompt** exactly - do not skip ahead

The prompt is designed to force proper discovery before implementation. Do not skip the audit.

---

**End of Handoff Package**
