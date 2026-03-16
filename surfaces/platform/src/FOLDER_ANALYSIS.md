# 6-ui/a2r-platform/src/ Folder Analysis

**Generated:** 2026-02-24  
**Purpose:** Understanding what each folder actually does

---

## Core Application Structure

### `shell/` - MAIN APPLICATION SHELL
**What it is:** The root application container
**Key files:**
- `ShellApp.tsx` - Main app component, renders the entire shell
- `ShellFrame.tsx` - Window frame/chrome
- `ShellRail.tsx` - Side navigation rail
- `ShellCanvas.tsx` - Main content area
- `ShellHeader.tsx` - Top header with mode switcher

**Depends on:** nav/, views/, drawers/, dock/

---

### `views/` - VIEW REGISTRY
**What it is:** All the different "pages" or "screens" in the app
**Key views:**
- `ChatView.tsx` - Chat interface
- `CoworkView.tsx` - Coworking mode (collaboration)
- `code/` - Code editor views (SkillsRegistryView, ToolsView, etc.)
- `agent-character/` - Agent character management
- `openclaw/OpenClawControlUI.tsx` - OpenClaw integration
- `HomeView.tsx`, `TerminalView.tsx`, `RunnerView.tsx`, etc.

**Depends on:** capsules/, components/, runner/, services/

---

### `capsules/` - BROWSER/TAB SYSTEM
**What it is:** The tabbed browser system - like browser tabs but for A2R
**Key components:**
- `BrowserCapsuleEnhanced` - Main browser component with tabs
- `a2ui/` - A2UI rendering system (renders AI-generated UI)
- `capsule.types.ts` - Type definitions for capsules
- `CapsuleHost.tsx` - Host component for capsules

**Purpose:** Manages browser-like tabs for different content types (web, A2UI, miniapps)

---

### `runner/` - AGENT RUNNER SYSTEM (DAK)
**What it is:** The Deterministic Agent Kernel runner
**Key components:**
- `AgentRunnerPanel.tsx` - Main runner panel
- `AgentInvokeBar.tsx` - Invocation bar
- `dak.store.ts` - DAK state management
- `dak.types.ts` - DAK types

**Purpose:** Executes agent tasks, manages DAG (Directed Acyclic Graph) execution

---

### `dock/` - TASK DOCK
**What it is:** Bottom dock showing running tasks/tickets
**Key files:**
- `TaskDock.tsx` - The dock component
- `ticket.store.ts` - Ticket state
- `ticket.model.ts` - Ticket data model

**Purpose:** Shows active tasks, similar to macOS Dock or Windows Taskbar

---

### `drawers/` - SIDE DRAWERS
**What it is:** Slide-out panels from the sides
**Key files:**
- `ConsoleDrawer.tsx` - Console/logs drawer
- `InspectorDrawer.tsx` - Inspector panel
- `drawer.store.ts` - Drawer state management

**Purpose:** Side panels that can slide in/out (console, inspector, etc.)

---

## State Management

### `state/` - ZUSTAND STORES (Visual/Workflow State)
**What it is:** Zustand-based state for visual workflows
**Key files:**
- `useDagState.ts` - DAG (Directed Acyclic Graph) workflow state
- `useSandboxStore.ts` - Code sandbox state

**Purpose:** Visual workflow state, sandbox management

**Naming Issue:** Should be `workflow-state/` or `dag-state/` to be clearer

---

### `store/` - REDUX SLICES (Data State)
**What it is:** Redux Toolkit slices for application data
**Key files:**
- `slices/mcpAppsSlice.ts` - MCP (Model Context Protocol) apps state

**Purpose:** Data state management, API caching

**Naming Issue:** Should be `data-store/` or `redux-slices/` to differentiate from `state/`

---

### `nav/` - NAVIGATION STATE
**What it is:** Navigation/routing state
**Key files:**
- `nav.store.ts` - Navigation state
- `nav.history.ts` - Navigation history
- `nav.selectors.ts` - Navigation selectors
- `nav.types.ts` - Navigation types
- `nav.policy.ts` - Navigation policies
- `useNav.ts` - Navigation hook

**Purpose:** Tracks current view, navigation history, view transitions

**Naming Issue:** Actually well-named! Clear what it does.

---

## Components & Design

### `components/` - UI COMPONENTS
**What it is:** Reusable UI components
**Contents:**
- `ai-elements/` - AI-specific UI components (50+ components)
- `code/` - Code-related components (editor, syntax highlighting, etc.)
- `BrowserTimeline/` - Browser history timeline
- `CapsuleFrame/` - Frame for capsules
- `model-picker.tsx` - Model selection UI
- `icons/`, `prompt-kit/`, etc.

---

### `design/` - DESIGN SYSTEM
**What it is:** Design tokens, themes, styling
**Key files:**
- `tokens.ts` - Design tokens (colors, spacing, etc.)
- `theme.css`, `modeStyles.css` - CSS themes
- `ThemeStore.ts` - Theme state
- `GlassCard.tsx`, `GlassSurface.tsx` - Glassmorphism components
- `motion/` - Animation/motion definitions
- `controls/` - Form controls (IconButton, SegmentedControl, etc.)

**Purpose:** The visual design system

---

## Services & Integration

### `services/` - API SERVICES
**What it is:** API clients and service logic
**Contents:**
- `capsuleApi.ts` - Capsule API
- `code/` - Code-related services
- `voice/` - Voice services
- `workspace/` - Workspace services
- `ProviderAuthService.ts` - Provider authentication
- `SkillInstallerApiService.ts` - Skill installation

**Purpose:** Business logic, API communication

---

### `integration/` - EXTERNAL INTEGRATIONS
**What it is:** Integrations with external systems
**Contents:**
- `api-client.ts` - Main API client
- `a2ui-client.ts` - A2UI backend client
- `browser-client.ts` - Browser integration client
- `session-bridge.ts` - Session bridging
- `a2r/` - A2R-specific integration
- `execution/` - Execution environment integration
- `kernel/` - Kernel integration

**Purpose:** External system connections

---

### `hooks/` - CUSTOM REACT HOOKS
**What it is:** Reusable React hooks
**Key hooks:**
- `useBrainChat.ts` - Brain chat functionality
- `useCapsule.ts` - Capsule management
- `useVoice.ts` - Voice features
- `useWorkflow.ts` - Workflow management
- `useBudget.ts` - Budget tracking
- etc.

---

### `providers/` - REACT CONTEXT PROVIDERS
**What it is:** React Context providers
**Key providers:**
- `session-provider.tsx` - Session context
- `chat-models-provider.tsx` - Chat model context
- `voice-provider.tsx` - Voice context
- `data-stream-provider.tsx` - Data stream context
- etc.

---

## Supporting Systems

### `lib/` - LIBRARY CODE
**What it is:** Utility libraries, helpers
**Contents:**
- `agents/` - Agent utilities
- `ai/` - AI-related utilities
- `artifacts/` - Artifact handling
- `auth.ts` - Authentication utilities
- `blob.ts` - Blob handling
- `config.ts` - Configuration utilities

---

### `types/` - TYPE DEFINITIONS
**What it is:** Shared TypeScript types
**Contents:**
- `code/` - Code-related types
- `plugin.ts` - Plugin types

---

### `network/` - NETWORKING
**What it is:** Network adapters and clients
**Contents:**
- `adapters/` - Network adapters
- `tambo-client.ts` - Tambo client

---

### `policies/` - POLICY DEFINITIONS
**What it is:** Policy/governance definitions
**Key file:**
- `mcp-apps.policy.ts` - MCP apps policy

---

### `qa/` - QA UTILITIES
**What it is:** Quality assurance utilities
**Contents:**
- `invariants.ts` - Runtime invariants
- `smoke.ts` - Smoke tests

---

### `vendor/` - VENDOR WRAPPERS
**What it is:** Wrappers around third-party libraries
**Contents:**
- `hotkeys.tsx` - Hotkey library wrapper
- `command.tsx` - Command palette wrapper
- `panels.ts` - Panel library wrapper
- `flexlayout.ts` - Flex layout wrapper
- `radix.ts` - Radix UI wrapper

---

## Special Folders

### `agent-workspace/` - AGENT WORKSPACE (NEW)
**What it is:** Workspace management for agents
**Key files:**
- `wasm-wrapper.ts` - WASM integration
- `http-client.ts` - HTTP client for workspace
- `types.ts` - Workspace types

**Status:** NEW - Just created

---

### `a2r-usage/` - USAGE TRACKING
**What it is:** Usage telemetry and tracking
**Key files:**
- `electron-preload.ts` - Electron preload for usage tracking
- `plugins/` - Usage plugins
- `ui/` - Usage UI components

---

### `app/` - NEXT.JS APP ROUTER (if using Next.js)
**What it is:** Next.js app directory structure
**Contents:**
- `(chat)/` - Chat route group
- `api/` - API routes
- `globals.css` - Global styles

**Note:** May be legacy or for web version

---

### `dev/` - DEVELOPMENT TOOLS
**What it is:** Development utilities
**Contents:**
- `agentation/` - Agentation dev tools

---

### `legacy/` - LEGACY CODE
**What it is:** Old/deprecated code
**Contents:**
- `ai-elements/` - Old AI elements

**Status:** Safe to delete after migration

---

### `surfaces/` - SURFACE COMPONENTS
**What it is:** Surface-level UI components
**Contents:**
- `BrowserSurface.tsx` - Browser surface
- `types.ts` - Surface types

---

## Root Files

### `index.ts` - MAIN EXPORTS
**What it is:** Barrel export file
**Exports:** Everything from all submodules

### `agent-runner.tsx` - AGENT RUNNER ENTRY
**What it is:** Entry point for agent runner window

---

## RENAMING RECOMMENDATIONS

### State Management (Confusing Names)

| Current | Problem | Suggested |
|---------|---------|-----------|
| `state/` | Too generic | `dag-state/` or `workflow-state/` |
| `store/` | Too generic | `app-store/` or `redux-slices/` |
| `nav/` | Actually good! | Keep as-is |

### Other Potential Renames

| Current | Problem | Suggested |
|---------|---------|-----------|
| `lib/` | Too generic | `utils/` or `utilities/` |
| `app/` | Ambiguous (Next.js vs general) | `next-app/` or move to web-specific |
| `a2r-usage/` | Unclear | `telemetry/` or `analytics/` |

---

## DEPENDENCY GRAPH (Simplified)

```
shell/ (ShellApp)
    ├── views/ (all views)
    ├── nav/ (navigation state)
    ├── drawers/ (ConsoleDrawer, etc.)
    └── dock/ (TaskDock)

views/
    ├── capsules/ (browser tabs)
    ├── runner/ (DAK runner)
    └── components/ (UI components)

capsules/
    ├── services/ (API calls)
    └── hooks/ (React hooks)

services/
    └── integration/ (API clients)

State Management:
    ├── nav/ (navigation state) → used by shell/, views/
    ├── state/ (DAG state) → used by runner/, services/code/
    └── store/ (app data) → used by services/, hooks/
```

---

## SUMMARY

**Well-named folders:**
- `shell/` - Clear: main shell
- `views/` - Clear: view components
- `capsules/` - Clear: browser tab system
- `runner/` - Clear: agent runner
- `dock/` - Clear: task dock
- `drawers/` - Clear: side drawers
- `nav/` - Clear: navigation
- `components/` - Clear: UI components
- `design/` - Clear: design system
- `services/` - Clear: API services
- `hooks/` - Clear: React hooks
- `providers/` - Clear: Context providers

**Confusing names:**
- `state/` vs `store/` - Both mean "state", need differentiation
- `lib/` - Too vague
- `app/` - Ambiguous purpose
- `a2r-usage/` - Unclear meaning

**Questionable folders:**
- `agent-workspace/` - NEW, needs integration
- `legacy/` - Should be removed
- `dev/` - May be unused
- `surfaces/` - Overlaps with design/
