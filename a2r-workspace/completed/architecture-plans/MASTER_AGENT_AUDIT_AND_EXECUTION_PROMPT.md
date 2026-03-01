🔑 MASTER AGENT AUDIT + EXECUTION PROMPT

(Give this verbatim to the next agent)

⸻

# ROLE

You are a systems-level auditor + finisher for the A2rchitech Agentic OS.

Your job is NOT to invent new abstractions.

Your job is to:
  1. Audit what already exists (with file paths and evidence)
  2. Confirm what is reusable
  3. Identify only the real missing glue
  4. Finish the platform visually + functionally exactly as intended

You must assume:
  • No Tauri (already removed from the system)
  • Electron + Web + CLI are the runtime surfaces
  • The CLI is the root process
  • Everything else is subordinate

⸻

# CORE INTENT (READ CAREFULLY)

A2rchitech is becoming:

**A top-level CLI-driven agent runtime that orchestrates other CLIs (OpenCode, Claude Code, Gemini, AMP) as subprocess brains, exposes them via HTTP/SSE, renders them via OpenWork (forked), and augments them with UI-TARS for computer use — all surfaced visually through the Shell UI.**

You must align to this, not reinterpret it.

⸻

# PART 1 — AUDIT (MANDATORY)

Before proposing changes, you must produce an audit report that answers the following with file/line references.

## 1. CLI / Daemon

**Questions to answer:**

1. Where is the A2 CLI entrypoint?
   - Find the main() function for the a2 CLI
   - List all commands currently registered
   - Identify which commands spawn services vs which are informational

2. Does `a2 daemon` already act as an IO runner?
   - Check if daemon manages subprocess lifecycles
   - Check if it exposes HTTP endpoints
   - Check if it handles session I/O routing

3. Where would subprocess spawning live for CLI brains?
   - Find existing subprocess/PTY management code
   - Identify where OpenCode/Claude/Gemini wrappers would go

4. Does session state already exist?
   - Find session management structures
   - Check if RunState or similar exists
   - Identify how sessions are persisted

**Known locations to check:**
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/cli/src/main.rs`
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/cli/src/commands/daemon.rs`
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/cli/src/commands/`

**Goal:** Confirm the CLI is already ~80% of a top-process

---

## 2. Brain Runtime

**Questions to answer:**

1. Where is EventEnvelope defined?
   - Find the canonical event contract
   - Verify it has all required fields (session_id, type, timestamp, payload)
   - Check if it's used across services

2. How does run/session state work?
   - Find RunState or session state machine
   - Identify state transitions (running, paused, completed, etc.)
   - Check how state is persisted

3. Does SSE or event streaming exist internally?
   - Find SSE implementation (Axum/Actix/other)
   - Check how events are broadcast to clients
   - Identify event subscription mechanisms

4. Does a session abstraction already exist?
   - Find Session struct or similar
   - Check if sessions have lifecycle methods (create, start, stop, delete)
   - Identify how sessions are indexed/retrieved

**Known locations to check:**
- `~/Desktop/a2rchitech-workspace/a2rchitech/crates/kernel/kernel-contracts/src/lib.rs` (EventEnvelope is at lines 7-46)
- `~/Desktop/a2rchitech-workspace/a2rchitech/crates/kernel/kernel-contracts/src/lib.rs` (RunState is at lines 119-150)
- `~/Desktop/a2rchitech-workspace/a2rchitech/services/kernel/src/`
- `~/Desktop/a2rchitech-workspace/a2rchitech/crates/brain/`

**Goal:** Reuse — do NOT rebuild event/session infrastructure

---

## 3. CLI Brains (CRITICAL GAP)

**Questions to answer:**

1. Is there a PTY-based CLI brain wrapper?
   - Search for "pty", "pty_process", "terminal", "subprocess"
   - Check if there's a generic brain driver trait
   - Identify how command-line tools would be wrapped

2. Are OpenCode / Claude Code / Gemini already integrated?
   - Search for "openwork", "openwork_ai", "claude", "gemini"
   - Check if brain adapters exist
   - Verify if any are wired to session management

3. What are the closest existing terminal or SSH abstractions?
   - Find any shell/terminal execution code
   - Check if there's a pattern for spawning subprocesses
   - Identify code that could be adapted

**Expected finding:** This is a BUILD gap, not a refactor gap

**Known locations to check:**
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/shell/src/components/BrainManagerWidgetRedesigned.tsx` (PRESET_RUNTIMES reference)
- `~/Desktop/a2rchitech-workspace/a2rchitech/crates/brain/src/` (if it exists)
- `~/Desktop/a2rchitech-workspace/a2rchitech/crates/tools/src/` (for subprocess patterns)

**Goal:** Prove this is a build-gap, not a refactor

---

## 4. OpenWork

**Questions to answer:**

1. Is OpenWork a separate repo?
   - Confirm OpenWork location (`~/Desktop/openwork/`)
   - Verify it's a standalone Next.js project
   - Check its build/runtime dependencies

2. Does it wrap OpenCode?
   - Find OpenCode integration in OpenWork codebase
   - Check how OpenWork connects to agent sessions
   - Identify the API surface between OpenWork and agents

3. Is it integrated into Shell?
   - Check if there's an "openwork" ViewMode or tab
   - Verify if there's an iframe or webview embedding
   - Confirm if there's any shared state between Shell and OpenWork

4. Does Shell have tab/view infrastructure to host it?
   - Find ViewMode enum in LeftRail.tsx
   - Check if adding a new ViewMode is the pattern
   - Identify how tabs are managed

**Known locations to check:**
- `~/Desktop/openwork/` (OpenWork repo root)
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/shell/src/components/LeftRail.tsx` (ViewMode enum)
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/shell/src/`

**Goal:** Decide fork + embed, not rewrite

---

## 5. UI-TARS

**Questions to answer:**

1. Does the UI-TARS skill exist?
   - Find `ui_tars` in skills directory
   - Check if it has a propose method
   - Verify skill registration

2. Does the operator service exist?
   - Find UI-TARS operator service
   - Check its port assignment (expected: 3008)
   - Verify it exposes HTTP endpoints

3. Does it only propose actions, not execute?
   - Check the `propose` endpoint signature
   - Verify if there's an `execute` endpoint
   - Confirm the action loop (screenshot → propose → ???)

4. Are GUI tools (click/type/screenshot) registered?
   - Check tool gateway for GUI-related tools
   - Verify if gui.click, gui.type, gui.screenshot exist
   - Confirm if they're wired to UI-TARS operator

**Known locations to check:**
- `~/Desktop/a2rchitech-workspace/a2rchitech/crates/skills/src/ui_tars/mod.rs` (skill definition)
- `~/Desktop/a2rchitech-workspace/a2rchitech/services/ui-tars-operator/src/main.py` (FastAPI service)
- `~/Desktop/a2rchitech-workspace/a2rchitech/services/ui-tars-operator/repository/` (cloned UI-TARS)
- `~/Desktop/a2rchitech-workspace/a2rchitech/crates/tools/src/` (for tool registration)
- `~/Desktop/a2rchitech-workspace/a2rchitech/crates/kernel/tools-gateway/src/lib.rs` (ToolGateway API)

**Goal:** Extend, not redesign

---

## 6. Shell UI

**Questions to answer:**

1. Does the capsule system exist?
   - Find capsule component definitions
   - Check if capsules have IDs, titles, content, state
   - Verify how capsules are rendered

2. Does a window state machine exist?
   - Find state management for capsules
   - Check for states: normal, minimized, maximized, closed
   - Verify how state transitions work

3. Are tabs/docking/minimize implemented?
   - Find tab strip components
   - Check drag-and-drop to tabs
   - Verify minimize → dock functionality
   - Confirm restore from tab behavior

4. Are icons emoji-based or missing?
   - Check how capsule icons are rendered
   - Verify if there's an icon system or just emojis
   - Identify icon asset locations

5. Are miniapps fully OS-grade yet?
   - Check if capsules have OS window behaviors
   - Verify z-order management
   - Confirm if they can overlap/focus/blur

**Known locations to check:**
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/shell/src/` (Shell UI root)
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/shell/src/components/` (components)
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/shell/src/stores/` (state management)
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/shell/src/assets/` (icons)

**Goal:** Finish OS behavior visually

---

# PART 2 — REQUIRED CONCLUSIONS

You must explicitly classify each subsystem as:
  • ✅ REUSE (exists as-is, no changes needed)
  • 🔄 EXTEND (exists but needs enhancement)
  • 🏗️ BUILD (does not exist, must create from scratch)

And justify why.

**Classification template:**

```
## [Subsystem Name]

**Status:** REUSE / EXTEND / BUILD

**Evidence:**
- [File path] with line numbers
- [Code snippet or description]

**Justification:**
[Why this classification is correct]

**Action:**
[What to do with this subsystem]
```

**If you rebuild something that already exists, that is a failure.**

---

# PART 3 — TARGET ARCHITECTURE (YOU MUST MATCH THIS)

## 1. CLI is the Root Brain

```
a2 (CLI, top process)
│
├── daemon (lifecycle + IO)
│   ├── HTTP server (port 3000)
│   ├── SSE broadcaster
│   └── Session registry
│
├── brain sessions (HTTP + SSE)
│   ├── OpenCode (PTY subprocess)
│   ├── Claude Code (PTY subprocess)
│   ├── Gemini (PTY subprocess)
│   └── AMP (PTY subprocess)
│
├── tools
│   ├── bash (execute shell commands)
│   ├── git (version control)
│   ├── fs (file system operations)
│   └── ui-tars (GUI control)
│       ├── screenshot
│       ├── click
│       ├── type
│       └── scroll
│
└── services
    ├── ui-tars operator (FastAPI, port 3008)
    └── tool gateway (tool registration/execution)
```

**The CLI spawns and owns everything.**

**Key points:**
- CLI is entrypoint (`a2 up` starts everything)
- Daemon manages service lifecycles
- HTTP/SSE is the only external API surface
- CLI brains run as PTY subprocesses, not external services
- UI-TARS is a tool, invoked by brains, not a brain itself

---

## 2. OpenWork = Ops Center (NOT the brain)

OpenWork is:
  • A GUI control plane for sessions
  • A session visualizer (watching streams of events)
  • A template + permissions UI for capsule management

**It does NOT:**
  • Replace the CLI
  • Run sessions directly
  • Own brain logic

**OpenWork must appear as:**
  • A tab/view inside the Shell UI (not separate window)
  • Accessible via ViewMode::OpenWork in LeftRail
  • Embedded via iframe pointing to http://localhost:5173

**Integration points:**
- OpenWork reads events from `/v1/sessions/{id}/events` (SSE)
- OpenWork sends commands to `/v1/sessions/{id}/commands` (HTTP POST)
- OpenWork lists sessions from `/v1/sessions` (HTTP GET)

---

## 3. UI-TARS = Tool, Not a Brain

UI-TARS:
  • Never owns sessions
  • Never plans globally
  • Only executes GUI actions when invoked by a brain

**Execution loop:**

```
[Brain] → "Take a screenshot"
  ↓
[Tool: gui.screenshot] → Capture screen → Return base64 image
  ↓
[Brain] → "What should I do?" (passes screenshot to UI-TARS)
  ↓
[Tool: ui_tars.propose] → UI-TARS operator → Returns action plan
  ↓
[Brain] → "Click at (x,y)"
  ↓
[Tool: gui.click] → Execute click
  ↓
[Brain] → "Verify action worked" → Repeat loop
```

**You must wire these as real tools, not stubs:**

```rust
// In crates/tools/src/gui.rs or similar

#[tool(name = "gui.screenshot")]
async fn gui_screenshot() -> Result<String> {
    // Capture screen, return base64 image
}

#[tool(name = "gui.click")]
async fn gui_click(x: u32, y: u32) -> Result<()> {
    // Execute click at coordinates
}

#[tool(name = "gui.type")]
async fn gui_type(text: String) -> Result<()> {
    // Type text into focused element
}

#[tool(name = "gui.scroll")]
async fn gui_scroll(dx: i32, dy: i32) -> Result<()> {
    // Scroll viewport
}
```

**UI-TARS operator integration:**

```rust
// In crates/skills/src/ui_tars/mod.rs

#[tool(name = "ui_tars.propose")]
async fn ui_tars_propose(
    task: String,
    screenshot: String, // base64
    viewport: Viewport,
) -> Result<UiTarsAction> {
    // POST to http://localhost:3008/v1/model/ui_tars/propose
    // Parse and return action
}
```

---

## 4. Shell UI = Visual OS

Shell must visually support:

**Capsule as OS window:**
- Title bar with close/minimize/maximize buttons
- Draggable and resizable
- Z-order management (click to front)
- Focus/blur states

**Minimize → Dock:**
- Click minimize → Capsule moves to dock at bottom
- Dock shows capsule icon + title
- Click dock item → Restore to previous position

**Drag → TabStrip:**
- Drag capsule title → Convert to tab
- Tabs appear in tab strip at top
- Tab shows capsule icon + title

**Restore from tab:**
- Click tab → Detach as floating capsule
- Or tear off tab → Create floating capsule

**Reopen closed capsules:**
- Track closed capsules in session history
- "Reopen" menu shows recently closed
- Click → Restore with previous state

**Icon system:**
- Non-emoji SVG icons per capsule type
- Auto-generated icon on capsule creation
- Icon folder structure:
  ```
  apps/shell/src/assets/icons/
    ├── capsule/
    │   ├── terminal.svg
    │   ├── chat.svg
    │   ├── code-editor.svg
    │   ├── browser.svg
    │   └── openwork.svg
    └── miniapp/
        ├── weather.svg
        ├── notes.svg
        └── calculator.svg
  ```

**Icon generation rules:**
- Capsules created from templates use template's icon
- Capsules created from scratch get generic icon
- Miniapp capsules use miniapp's icon
- Fallback: Generic capsule icon if type unknown

---

# PART 4 — VISUAL DELIVERABLES REQUIRED

You must produce the following diagrams as part of your audit:

## 1. Shell UI Layout Diagram

Show the visual structure of the Shell UI with:
- Left rail (tabs: Canvas, Studio, Registry, Marketplace, Chats, OpenWork)
- Main content area (capsule workspace)
- Tab strip (for tabbed capsules)
- Dock (minimized capsules)
- Top bar (session controls, status)

**Format:** ASCII art or SVG-style text diagram

## 2. Capsule Lifecycle Diagram

Show state transitions:
```
Creating → Normal → Minimized → Dock
  ↓         ↓         ↓
Closed    Closed    Restored
  ↓         ↓
Reopen    Restore
```

**Format:** State machine diagram

## 3. CLI ↔ OpenWork ↔ UI-TARS Flow Diagram

Show data flow:
```
[CLI Daemon] ←→ [OpenWork (Shell Tab)]
    ↓                ↓
[Session API]    [Event Stream (SSE)]
    ↓                ↓
[Brain Process] ← [OpenWork UI]
    ↓
[Tool Gateway]
    ↓
[UI-TARS Operator]
    ↓
[GUI Tools (screenshot/click/type/scroll)]
```

**Format:** Flow diagram with arrows

## 4. Icon System Specification

Document:
- Naming convention (kebab-case, singular)
- Folder structure (as shown above)
- Generation rules (as shown above)
- Fallback behavior
- Icon file format (SVG, 24x24 or 32x32)
- Color system (primary, accent, neutral)

**Format:** Markdown specification table

---

# PART 5 — EXECUTION PLAN (NO FLUFF)

Provide:
  • Phases (max 6)
  • Acceptance criteria per phase
  • Exact files to create / modify
  • What is reused vs built

**No hypotheticals.**
**No "could".**
**No stubs.**

**Template:**

```
## Phase N: [Phase Name]

**Duration:** [X hours/days]

**Goals:**
- [Goal 1]
- [Goal 2]

**Files to CREATE:**
- [path/to/new/file.rs] (description)
- [path/to/new/file.tsx] (description)

**Files to MODIFY:**
- [path/to/existing/file.rs] (changes needed)
- [path/to/existing/file.tsx] (changes needed)

**Files to REUSE as-is:**
- [path/to/file.rs] (no changes)

**Acceptance Criteria:**
- [ ] [Testable criterion 1]
- [ ] [Testable criterion 2]
- [ ] [Testable criterion 3]

**Verification Steps:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Dependencies:** [Phase N-1 or external]
**Deliverables:** [What you'll have at the end]
```

---

# HARD CONSTRAINTS

You MUST respect these:

- ❌ **No Tauri** (already removed, do not add back)
- ❌ **No emoji icons** (use SVG assets only)
- ❌ **No fake demos** (all functionality must work end-to-end)
- ❌ **No parallel architectures** (single source of truth per subsystem)
- ✅ **Fork OpenWork, don't reinvent** (embed it, don't rewrite)
- ✅ **CLI is first-class** (everything starts from `a2`)
- ✅ **Shell UI is the OS** (all visual behavior must feel native)

---

# SUCCESS CONDITION

At the end, I should be able to:

1. Run `a2 up` → All services start successfully
2. Launch OpenWork → Appears as a tab in Shell UI
3. Start a session → Choose Claude/OpenCode, see it running
4. Watch it live → See events streaming in OpenWork UI
5. Let it click/type → UI-TARS executes GUI actions
6. Minimize, tab, restore → All window behaviors work
7. Never wonder where something lives → Clear file organization

**If any of these fail, the implementation is incomplete.**

---

# IF YOU UNDERSTAND THIS, BEGIN WITH THE AUDIT

Start with PART 1. Answer every question with file paths and line numbers.

Produce a comprehensive audit report before writing any code.

Only after the audit is complete, proceed to PART 2 (classifications), then PART 3 (architecture alignment), then PART 4 (visual deliverables), then PART 5 (execution plan).

**Do not skip the audit.**
**Do not assume without verifying.**
**Do not rebuild what exists.**

⸻

# REFERENCE: KNOWN FILE LOCATIONS

## CLI
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/cli/src/main.rs`
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/cli/src/commands/daemon.rs`
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/cli/src/commands/`

## Kernel
- `~/Desktop/a2rchitech-workspace/a2rchitech/crates/kernel/kernel-contracts/src/lib.rs` (EventEnvelope: 7-46, RunState: 119-150)
- `~/Desktop/a2rchitech-workspace/a2rchitech/crates/kernel/tools-gateway/src/lib.rs`
- `~/Desktop/a2rchitech-workspace/a2rchitech/services/kernel/src/`

## Brain
- `~/Desktop/a2rchitech-workspace/a2rchitech/crates/brain/src/` (if exists)
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/shell/src/components/BrainManagerWidgetRedesigned.tsx`

## Tools
- `~/Desktop/a2rchitech-workspace/a2rchitech/crates/tools/src/`
- `~/Desktop/a2rchitech-workspace/a2rchitech/crates/skills/src/ui_tars/mod.rs`

## UI-TARS
- `~/Desktop/a2rchitech-workspace/a2rchitech/services/ui-tars-operator/src/main.py`
- `~/Desktop/a2rchitech-workspace/a2rchitech/services/ui-tars-operator/repository/`

## Shell UI
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/shell/src/`
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/shell/src/components/LeftRail.tsx`
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/shell/src/stores/`
- `~/Desktop/a2rchitech-workspace/a2rchitech/apps/shell/src/assets/`

## OpenWork
- `~/Desktop/openwork/` (standalone repo)

⸻

**END OF PROMPT**

Give this verbatim to the next agent.