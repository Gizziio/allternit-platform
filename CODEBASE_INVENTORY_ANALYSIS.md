# A2R Codebase Inventory Analysis

**Date:** 2026-02-24  
**Purpose:** Comprehensive analysis of what's used vs what's scattered/dead

---

## EXECUTIVE SUMMARY

The codebase has significant fragmentation and duplication. Key findings:

1. **TUI is in `7-apps/cli`**, not in agent-shell
2. **agent-shell is forked opencode** - contains both useful code AND dead code
3. **6-ui has 632 files** - likely contains dead/scattered implementations
4. **Multiple shells exist** - shell-electron, shell-ui, agent-shell
5. **Naming confusion** - opencode vs a2r throughout

---

## 6-UI ANALYSIS

### 6-ui/a2r-platform/ (632 files)

| Folder | Status | Description | Dependencies |
|--------|--------|-------------|--------------|
| **src/shell/** | ✅ ACTIVE | ShellApp, ShellFrame, ShellHeader, ShellRail, ShellCanvas | Used by shell-ui |
| **src/capsules/** | ✅ ACTIVE | BrowserCapsule, A2UIRenderer, tab system | Core feature |
| **src/runner/** | ✅ ACTIVE | AgentRunnerPanel, RunnerTraceSidebar | Core feature |
| **src/dock/** | ✅ ACTIVE | TaskDock, ticket system | Core feature |
| **src/drawers/** | ✅ ACTIVE | ConsoleDrawer | Core feature |
| **src/components/** | ✅ ACTIVE | ai-elements (50+ components) | Core feature |
| **src/design/** | ✅ ACTIVE | GlassSurface, GlassCard, tokens, motion | Design system |
| **src/nav/** | ✅ ACTIVE | Navigation state, history, policy | Core feature |
| **src/views/** | ✅ ACTIVE | ViewHost, ViewLifecycle | Core feature |
| **src/services/voice** | ✅ ACTIVE | Voice services | Core feature |
| **src/integration/** | ⚠️ MIXED | api-client (active), kernel/ (deprecated?), execution/ (deprecated?) | Check usage |
| **src/state/** | ⚠️ UNCLEAR | State management - check if duplicated with stores/ | Needs audit |
| **src/store/** | ⚠️ UNCLEAR | Another state folder - likely duplication | Needs consolidation |
| **src/agent-workspace/** | ⚠️ NEW/STUB | Just created - has STUBS | Needs real implementation |
| **src/components/workspace/** | ⚠️ NEW/STUB | Just created - has STUBS | Needs real implementation |
| **src/a2r-usage/** | ❓ UNKNOWN | Purpose unclear | Needs investigation |
| **src/legacy/** | ⚠️ LIKELY DEAD | Legacy code - probably dead | Check if referenced |
| **src/dev/** | ❓ UNKNOWN | Dev tools? | Needs investigation |
| **src/lib/** | ❓ UNKNOWN | Library code? | Check exports |
| **src/network/** | ❓ UNKNOWN | Network layer? | Check vs integration/ |
| **src/surfaces/** | ❓ UNKNOWN | Surface components? | Check vs design/ |
| **src/types/** | ⚠️ PARTIAL | Types - may have duplicates with other folders | Needs consolidation |
| **src/vendor/** | ✅ ACTIVE | Vendor wrappers (hotkeys, command, panels, etc) | Used throughout |
| **src/hooks/** | ✅ ACTIVE | React hooks | Used throughout |
| **src/providers/** | ✅ ACTIVE | React providers | Used throughout |
| **src/policies/** | ❓ UNKNOWN | Policy definitions? | Check usage |
| **src/qa/** | ⚠️ TESTING | QA utilities | Keep for testing |

### 6-ui/canvas-monitor/ 
Status: ❓ UNKNOWN
- Purpose unclear
- May be dead or experimental

### 6-ui/rust/
Status: ❓ UNKNOWN
- Rust UI code?
- May be experimental/unused

### 6-ui/shell-ui/
Status: ⚠️ DUPLICATION?
- Contains "views" folder
- May overlap with 7-apps/shell-ui
- **POTENTIAL CONSOLIDATION TARGET**

### 6-ui/stubs/
Status: ❓ UNKNOWN
- Stub implementations?
- Likely can be removed

### 6-ui/ts/
Status: ❓ UNKNOWN
- TypeScript utilities?
- May overlap with other folders

---

## 7-APPS ANALYSIS

### 7-apps/cli/ (Rust)

| File/Folder | Status | Description | Notes |
|-------------|--------|-------------|-------|
| **src/main.rs** | ✅ ACTIVE | CLI entry point | Uses opencode naming |
| **src/commands/tui.rs** | ✅ ACTIVE | TUI command implementation | This is YOUR TUI |
| **src/tui_components/** | ✅ ACTIVE | Ratatui components (blocks, diff, git, history, hooks, input, syntax) | TUI UI components |
| **src/commands/mod.rs** | ✅ ACTIVE | Command registry | Uses opencode naming |
| **src/client.rs** | ✅ ACTIVE | HTTP client | Uses opencode naming |
| **src/config.rs** | ✅ ACTIVE | Configuration | Uses opencode naming |
| **src/bootstrap.rs** | ✅ ACTIVE | Bootstrap logic | Uses opencode naming |
| **src/commands/** | ⚠️ MIXED | Various commands - some may be dead | Audit each file |
| **src/tui_components/mode.rs** | ✅ ACTIVE | TUI mode system | Part of TUI |
| **src/tui_components/theme.rs** | ✅ ACTIVE | TUI theme system | Part of TUI |
| **src/tui_components/agent_identity.rs** | ✅ ACTIVE | Agent identity in TUI | Part of TUI |
| **src/tui_components/agent_create_wizard.rs** | ✅ ACTIVE | Agent creation wizard | Part of TUI |
| **src/fast_route.rs** | ❓ UNKNOWN | Fast routing? | Check usage |
| **src/command_registry/** | ❓ UNKNOWN | Command registry system | Check if used |

### 7-apps/agent-shell/a2r-shell/ (Forked opencode)

**CRITICAL DECISION NEEDED:** This entire folder is forked opencode code.

#### What's ACTUALLY USED (TUI related):
| File | Status | Description |
|------|--------|-------------|
| **packages/a2r-shell/src/** | ⚠️ MAYBE | Shell library code |
| **packages/app/src/** | ❓ UNKNOWN | App code - check if used |

#### What's REFERENCE ONLY (Not used but has good patterns):
| File | Status | Description |
|------|--------|-------------|
| **packages/desktop/src-tauri/src/cli.rs** | 📚 REFERENCE | Sidecar spawning patterns |
| **packages/desktop/src-tauri/src/server.rs** | 📚 REFERENCE | Health check patterns |
| **packages/desktop/src-tauri/src/lib.rs** | 📚 REFERENCE | Tauri app structure |

#### What's LIKELY DEAD:
| File | Status | Description |
|------|--------|-------------|
| **packages/web/** | ❓ UNKNOWN | Web version? Not used in Electron flow |
| **packages/slack/** | ❓ UNKNOWN | Slack integration? |
| **packages/chrome-extension/** | ❓ UNKNOWN | Chrome extension? |
| **packages/vscode/** | ❓ UNKNOWN | VSCode extension? |
| **packages/sdk/** | ❓ UNKNOWN | SDK code? |
| **packages/ui/** | ❓ UNKNOWN | UI components? (duplicated with a2r-platform?) |
| **sdks/** | ❓ UNKNOWN | SDKs |

### 7-apps/shell-electron/

| File | Status | Description |
|------|--------|-------------|
| **main/index.cjs** | ✅ ACTIVE | Main process entry |
| **main/sidecar-integration.cjs** | ⚠️ PARTIAL | Sidecar - INCOMPLETE (30% done) |
| **src-electron/main/** | ✅ ACTIVE | TypeScript main process code |
| **src-electron/main/index.ts** | ✅ ACTIVE | Main process features (tray, menu, dock, updater, etc) |
| **src-electron/main/tray.ts** | ✅ ACTIVE | System tray |
| **src-electron/main/menu.ts** | ✅ ACTIVE | Application menu |
| **src-electron/main/updater.ts** | ✅ ACTIVE | Auto-updater |
| **src-electron/main/notifications.ts** | ✅ ACTIVE | Notifications |
| **src-electron/main/dock.ts** | ✅ ACTIVE | macOS dock |
| **src-electron/main/protocol.ts** | ✅ ACTIVE | Deep linking |
| **src-electron/main/power-monitor.ts** | ✅ ACTIVE | Power monitoring |
| **src-electron/main/window-manager.ts** | ✅ ACTIVE | Window management |
| **src-electron/main/ipc-handlers.ts** | ✅ ACTIVE | IPC handlers |
| **src-electron/preload/** | ✅ ACTIVE | Preload scripts |
| **src-electron/renderer/** | ✅ ACTIVE | Renderer utilities |
| **src/browser/** | ❓ UNKNOWN | Browser code? |

### 7-apps/shell-ui/

| File | Status | Description |
|------|--------|-------------|
| **src/main.tsx** | ✅ ACTIVE | Entry point - mounts @a2r/platform ShellApp |
| **src/agent-runner.tsx** | ✅ ACTIVE | Agent runner window entry |
| **src/components/** | ⚠️ MAYBE | Components - may overlap with a2r-platform |
| **src/hooks/** | ⚠️ MAYBE | Hooks - may overlap with a2r-platform |
| **src/services/** | ⚠️ MAYBE | Services - may overlap with a2r-platform |
| **src/stores/** | ⚠️ MAYBE | Stores - may overlap with a2r-platform/state/ |

### 7-apps/tui/a2r-shell/

**Status:** ⚠️ CONFUSING NAMING

This appears to be ANOTHER copy or reference to the Tauri shell.
The structure mirrors 7-apps/agent-shell/a2r-shell/.

**Verdict:** Likely duplication or symlink. Needs verification.

### 7-apps/api/

| File | Status | Description |
|------|--------|-------------|
| **src/** | ❓ UNKNOWN | API server code |
| **channels/** | ❓ UNKNOWN | Channel definitions |
| **handlers/** | ❓ UNKNOWN | Request handlers |
| **routes/** | ❓ UNKNOWN | API routes |
| **services/** | ❓ UNKNOWN | Services |
| **tools/** | ❓ UNKNOWN | Tools |

**Question:** Is this the ACTUAL API server that shell-electron connects to?
Or is it something else?

### 7-apps/ui/

| File | Status | Description |
|------|--------|
| **src/** | ⚠️ DUPLICATION? | UI code - likely overlaps with a2r-platform |
| **test/** | ✅ TESTING | Tests |

**Verdict:** Likely dead or experimental. a2r-platform is the main UI.

### 7-apps/openwork/

| File | Status | Description |
|------|--------|-------------|
| **src/** | ❓ UNKNOWN | OpenWork code |

**Purpose unclear.** Needs investigation.

### 7-apps/chrome-extension/

| File | Status | Description |
|------|--------|-------------|
| **src/** | ❓ UNKNOWN | Chrome extension code |

**Purpose unclear.** May be experimental.

### 7-apps/launcher/

| File | Status | Description |
|------|--------|-------------|
| **src/** | ❓ UNKNOWN | Launcher code |

**Purpose unclear.** Needs investigation.

### 7-apps/shared/

| File | Status | Description |
|------|--------|-------------|
| **src/** | ⚠️ MAYBE | Shared code |

Check if actually shared between apps or just scattered.

### 7-apps/agent-shell-acp-adapter/

| File | Status | Description |
|------|--------|-------------|
| **src/** | ❓ UNKNOWN | ACP adapter |

**Purpose unclear.** ACP = Agent Communication Protocol?

### 7-apps/ts/

| File | Status | Description |
|------|--------|-------------|
| **cli/** | ❓ UNKNOWN | TypeScript CLI? |

**Purpose unclear.** May be duplicate of Rust CLI.

### 7-apps/_legacy/

| File | Status | Description |
|------|--------|-------------|
| **shell/** | ❌ DEAD | Legacy shell code |

**Safe to delete** after verification.

---

## CONSOLIDATION RECOMMENDATIONS

### Immediate Consolidation (Before Porting Patterns)

#### 1. State Management (HIGH PRIORITY)
```
Current mess:
- 6-ui/a2r-platform/src/state/
- 6-ui/a2r-platform/src/store/
- 7-apps/shell-ui/src/stores/

Action: Consolidate into single state folder
Target: 6-ui/a2r-platform/src/state/ (single source of truth)
```

#### 2. Shell UI Entry Points (HIGH PRIORITY)
```
Current mess:
- 6-ui/shell-ui/ (folder with views/)
- 7-apps/shell-ui/ (actual used shell-ui)
- 7-apps/shell-electron/src-electron/renderer/ (renderer utils)

Action: 
- Delete 6-ui/shell-ui/ (appears to be duplicate)
- Keep 7-apps/shell-ui/ (actually used)
- Consolidate renderer utils
```

#### 3. TUI Code Extraction (MEDIUM PRIORITY)
```
Current mess:
- 7-apps/cli/src/commands/tui.rs (main TUI)
- 7-apps/cli/src/tui_components/ (TUI components)
- Mixed with other CLI commands

Action: Extract TUI to separate crate/package
Target: 7-apps/tui/ (as proper standalone TUI)
```

#### 4. API Server Clarification (HIGH PRIORITY)
```
Current mess:
- 7-apps/api/ (unknown status)
- 7-apps/shell-electron looks for sidecar at port 3010
- 7-apps/cli can run server mode

Action: Clarify which is the ACTUAL API server
Options:
  A) 7-apps/api/ is the server (keep, complete sidecar integration)
  B) 7-apps/cli serve is the server (fix sidecar to spawn CLI)
```

#### 5. Agent-Shell Fork Cleanup (MEDIUM PRIORITY)
```
Current mess:
- 7-apps/agent-shell/a2r-shell/ (forked opencode)
- 7-apps/tui/a2r-shell/ (appears to be duplicate)

Action:
- Identify what's actually used
- Extract TUI-related code
- Delete or archive the rest
```

---

## PATTERNS TO PORT (From agent-shell)

Once consolidation is done, port these patterns from agent-shell:

### 1. Sidecar Spawning (cli.rs)
- Port to: `7-apps/shell-electron/main/sidecar-integration.cjs`
- Patterns needed:
  - Dynamic port discovery
  - Binary path resolution
  - Process lifecycle management
  - Platform-specific spawning

### 2. Health Checks (server.rs)
- Port to: `7-apps/shell-electron/main/sidecar-integration.cjs`
- Patterns needed:
  - Polling loop
  - Timeout handling
  - Ready signaling

### 3. Secure Authentication
- Port to: `7-apps/shell-electron/main/sidecar-integration.cjs`
- Patterns needed:
  - Password generation
  - Env var passing
  - IPC for password retrieval

---

## QUESTIONS FOR CLARIFICATION

1. **Which is the API server?**
   - A) 7-apps/api/
   - B) 7-apps/cli serve
   - C) Something else

2. **Is 6-ui/shell-ui/ used?**
   - Appears to duplicate 7-apps/shell-ui/

3. **Is 7-apps/tui/ a duplicate of 7-apps/agent-shell/?**
   - Structure looks identical

4. **What is 7-apps/ui/?**
   - Duplicates a2r-platform?

5. **What is 7-apps/openwork/?**
   - Purpose unclear

6. **Which state management is canonical?**
   - state/ vs store/ vs stores/

---

## NEXT STEPS

1. **Answer clarification questions**
2. **Execute consolidation plan**
3. **Delete confirmed dead code**
4. **Port patterns from agent-shell**
5. **Implement missing features**

**DO NOT PROCEED WITH PATTERN PORTING UNTIL CONSOLIDATION IS COMPLETE.**
