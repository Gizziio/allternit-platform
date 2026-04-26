# RESEARCH FINDINGS & GAME PLAN

**Date:** 2026-02-23
**Purpose:** Report on existing implementations and gaps before proceeding

---

## 1. CONSOLE DRAWER - ✅ EXISTS

**Location:** `surfaces/allternit-platform/src/drawers/ConsoleDrawer.tsx`

**Structure:**
```
ConsoleDrawer.tsx (wrapper)
└── DrawerRoot.tsx (main implementation)
    ├── DrawerHandle.tsx (drag handle)
    ├── DrawerTabs.tsx (8 tabs)
    └── Tab Content Views:
        ├── Queue (KanbanBoard)
        ├── Context (ContextView)
        ├── Terminal (UnifiedTerminal)
        ├── Logs (LogsView)
        ├── Executions (RunsView)
        ├── Problems (ProblemsView)
        ├── Agents (OrchestrationView)
        └── Scheduler (SchedulerView)
```

**Current Tabs:**
- Queue (Kanban)
- Context
- Terminal
- Logs
- Executions
- Problems
- Agents
- Scheduler

**Features:**
- Resizable height (drag handle)
- Open/close toggle
- Tab switching
- Default height: 300px

**Gaps for DAG/Run Monitoring:**
- ❌ No DAG Graph view tab
- ❌ No Receipts view tab
- ❌ No Trace Timeline tab
- ❌ No Chat Transcript tab (for browser agent sessions)

**Recommendation:** ADD tabs, don't replace existing implementation

---

## 2. AGENT INVOKE BAR - ✅ EXISTS

**Location:** `surfaces/allternit-platform/src/runner/AgentInvokeBar.tsx`

**Purpose:** "Quick agent input bar" - the keyboard shortcut implementation you mentioned

**Features:**
- Uses `NewChatInput` component from ChatView
- Has "Allternit Vision Operator" badge
- Shows thought trace panel
- Expand/collapse functionality
- Loading state indicators
- Syncs with `useRunnerStore`

**Current Usage:**
- Used in `ShellOverlayLayer.tsx`
- Used in `AgentRunnerWindow.tsx`

**Integration Point:** This IS the "quick agent input" - Agentation should work WITH this, not replace it

**Recommendation:** 
- Keep AgentInvokeBar as primary quick input
- Agentation can be accessed via:
  - Settings toggle (dev mode only)
  - Context menu in BrowserView
  - NOT a replacement for AgentInvokeBar

---

## 3. CLAUDE CODE BROWSER EXTENSION - ⚠️ LIMITED INFO

**Research Result:** GitHub repo doesn't have detailed architecture docs

**What We Know:**
- Claude Code runs in terminal, IDE, or GitHub mentions
- NOT specifically a browser extension
- Plugin system exists

**What We Should Do:**
- Research browser-use.com cloud API instead
- Look at our existing `services/browser-runtime/` crate
- Check `surfaces/shell-ui/src/views/browserview/` Rust implementation (917 lines)

---

## 4. BROWSER SESSION SPEC - ⚠️ NO SPECIFIC SPEC FOUND

**What Exists:**
- `surfaces/shell-ui/src/views/browserview/src/lib.rs` (917 lines)
  - BrowserViewEngine struct
  - Playwright integration
  - Session management
  - Navigation controller
  - Capture manager

- `services/browser-runtime/` crate
  - Vision/audio streaming
  - Session synchronization

**Gap:** No formal "BrowserSessionSpec" document found

**Recommendation:** Create spec based on existing implementation

---

## 5. ENVIRONMENT CONTAINERS - ✅ EXISTS

**Location:** `cloud/` directory structure

**Crates Found:**
```
cloud/
├── allternit-cloud-core/       ← Core types, provider traits
├── allternit-cloud-api/        ← API server
├── allternit-cloud-ssh/        ← SSH connections, key management
├── allternit-cloud-deploy/     ← Deployment orchestrator, installer
├── allternit-cloud-wizard/     ← Setup wizard UI logic
└── allternit-cloud-providers/
    ├── aws/
    ├── digitalocean/
    ├── hetzner/
    ├── contabo/
    └── racknerd/
```

**Key Files:**
- `allternit-cloud-core/src/types.rs` - Environment container types
- `allternit-cloud-core/src/registry.rs` - Runtime target registry
- `allternit-cloud-deploy/src/orchestrator.rs` - Deployment orchestration
- `allternit-cloud-ssh/src/key_manager.rs` - SSH key management

**What This Means:**
- Deterministic environment containers ARE implemented
- Runtime targets ARE implemented
- Provider integration IS implemented

**Gap:** UI for managing these in Control Center

---

## 6. Allternit CLOUD SETUP - ✅ EXISTS

**UI Component:** `surfaces/allternit-platform/src/views/cloud-deploy/`

**Files:**
- `CloudDeployView.tsx` - Main 5-step wizard
- `api-client.ts` - API client
- `components/steps/` - Step components

**Current Steps:**
1. Deployment Type (Cloud vs BYOC VPS)
2. Provider Selection
3. Configuration
4. Deployment
5. Verification

**Gap:** This is a deployment wizard, NOT the ongoing management UI

**What's Missing:**
- Ongoing runtime management (start/stop/restart)
- Worker pool management
- SSH host management
- Credential rotation
- Health monitoring dashboard

---

## 7. EXISTING SHELLUI STRUCTURE

**Modes:**
- `global` → `rail.config.ts` (16 items)
- `cowork` → `cowork.config.ts` (17 items)
- `code` → `code.config.ts` (23 items - TOO MANY)

**Current Console Drawer Tabs:**
- Queue, Context, Terminal, Logs, Executions, Problems, Agents, Scheduler

**Current Agent Input:**
- `AgentInvokeBar.tsx` - Quick input with thought trace

---

## GAME PLAN (Revised Based on Research)

### Phase 1: Console Drawer Enhancement (2-3 hours)
**Goal:** Add DAG/Run monitoring tabs WITHOUT breaking existing tabs

**Tasks:**
- [ ] Add "DAG Graph" tab to `DrawerTabs.tsx`
- [ ] Add "Receipts" tab to `DrawerTabs.tsx`
- [ ] Create `DagGraphView.tsx` component
- [ ] Create `ReceiptsView.tsx` component
- [ ] Wire to existing run data

**Files to Modify:**
- `src/views/code/ConsoleDrawer/DrawerTabs.tsx`
- `src/views/code/ConsoleDrawer/DrawerRoot.tsx`
- NEW: `src/views/code/ConsoleDrawer/DagGraphView.tsx`
- NEW: `src/views/code/ConsoleDrawer/ReceiptsView.tsx`

---

### Phase 2: Control Center Overlay (4-6 hours)
**Goal:** Create Settings overlay for platform wiring

**Tasks:**
- [ ] Create `ControlCenter.tsx` component
- [ ] Add sections:
  - Compute & Runtimes (environment containers)
  - Secrets & Credentials
  - SSH Connections
  - Browser Extension Pairing
- [ ] Add VPS onboarding wizard (reuse cloud-deploy logic)
- [ ] Add gear icon to ShellHeader
- [ ] Wire to cloud crates

**Files to Create:**
- `src/shell/ControlCenter.tsx`
- `src/shell/ControlCenterSections.tsx`

**Files to Modify:**
- `src/shell/ShellHeader.tsx` (add gear icon)
- `src/shell/ShellApp.tsx` (add ControlCenter render)

---

### Phase 3: Environment Selector (2-3 hours)
**Goal:** Top bar runtime target switcher

**Tasks:**
- [ ] Create `EnvironmentSelector.tsx` component
- [ ] Dropdown: Cloud | BYOC VPS | Hybrid
- [ ] Show current runtime target
- [ ] "Manage..." link → Control Center
- [ ] Wire to `allternit-cloud-core/src/registry.rs`

**Files to Create:**
- `src/shell/EnvironmentSelector.tsx`

**Files to Modify:**
- `src/shell/ShellHeader.tsx` (add selector)

---

### Phase 4: Browser Agent Bar (4-6 hours)
**Goal:** Agent control bar INSIDE BrowserView

**Tasks:**
- [ ] Create `BrowserAgentBar.tsx` component
- [ ] Add to `BrowserCapsuleEnhanced.tsx`
- [ ] Endpoint switcher (Shell Browser | Extension endpoints)
- [ ] Mode toggle (Human | Assist | Agent)
- [ ] Goal input field
- [ ] Hand off / Take over buttons
- [ ] Wire to `services/browser-runtime/` crate

**Files to Create:**
- `src/capsules/browser/BrowserAgentBar.tsx`

**Files to Modify:**
- `src/capsules/browser/BrowserCapsuleEnhanced.tsx`

---

### Phase 5: Agentation Hybrid Access (2-3 hours)
**Goal:** Work WITH AgentInvokeBar, not replace it

**Tasks:**
- [ ] Add Agentation toggle to Control Center → Dev Tools
- [ ] Keyboard shortcut: Cmd+Shift+A (dev mode only)
- [ ] Agentation overlay attaches to BrowserView
- [ ] Output diffs as artifacts/patches

**Files to Modify:**
- `src/shell/ControlCenter.tsx` (add Dev Tools section)
- `src/dev/agentation/provider.tsx` (add keyboard shortcut)

---

## DECISIONS NEEDED FROM YOU

### 1. Console Drawer Tabs
**Current:** 8 tabs
**Adding:** DAG Graph, Receipts (2 more)
**Question:** OK to add these tabs, or should they be sub-views?

### 2. Control Center Location
**Option A:** Gear icon in ShellHeader (recommended)
**Option B:** Settings item in rail
**Question:** Which do you prefer?

### 3. Environment Selector
**Location:** ShellHeader (top bar)
**Question:** OK to add here, or different location?

### 4. Browser Agent Bar
**Location:** Inside BrowserView (docked top or bottom)
**Question:** Top or bottom docking?

### 5. Agentation Access
**Current:** Storybook only
**Adding:** Control Center toggle + Cmd+Shift+A
**Question:** OK to proceed with this approach?

---

## AWAITING YOUR APPROVAL

**Please confirm:**
1. [ ] Console Drawer tabs (DAG Graph, Receipts) - OK to add?
2. [ ] Control Center location (gear icon in header) - OK?
3. [ ] Environment Selector location (top bar) - OK?
4. [ ] Browser Agent Bar docking (top vs bottom) - Preference?
5. [ ] Agentation hybrid access (Control Center + shortcut) - OK?

**I will NOT implement until you approve each decision.**
