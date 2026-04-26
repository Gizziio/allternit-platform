# P0 IMPLEMENTATION PLAN
## Complete Task Map from Start to Finish

**Target**: Capsule Shell + Tab/Canvas Metaphor + Agent-Generated Mini-App Frameworks  
**Strategy**: Sequential PRs (A → B → C → D)  
**Goal**: Working demos for "search cats" and "note hello"  
**Approach**: Real implementations, no stub code

---

## 📚 SOURCES

This plan is derived from 53 Architecture corpus files:

**Canonical Process Files** (Read in order):
1. ARCHITECTURE_FOLDER_INTEGRATION_TASKLIST_v001.md
2. UNIFIED/SOT.md
3. BACKLOG_v001.md
4. ACCEPTANCE/AcceptanceTests.md

**Core Architecture Files**:
- LAW/ — Builder constraints, guardrails, OS rules, project law
- UI/ — Capsules, CapsuleProtocol, CanvasProtocol, Journal, MiniAppRuntime, PresentationKernel, RendererCapabilities, UTI
- BACKLOG/MD-007 through MD-017 — Glide integration, dynamic discovery, frameworks, mini-apps, Gizzi OS, patterns, directive compiler
- INTEGRATIONS/ — External system mappings

**Architecture Corpus Status**: ✅ COMPLETE (53 files read)

---

## 📦 REPOSITORY CONTEXT

**Existing Structure**:
- `apps/shell/` — Shell skeleton exists (minimal implementation)
- `apps/ui/` — Canvas renderer library exists
- `apps/shared/contracts.ts` — Local contracts exist
- `services/` — Gateway, router, policy, executor, audit-log services exist
- `crates/` — 17 workspace packages (sdk-core, runtime, history, policy, etc.)
- `spec/` — Contract specifications exist
- `packages/` — SDK packages

**Tech Stack**:
- Backend: Rust (WASM runtime)
- Frontend: TypeScript (React)
- Python Gateway: External integrations only

**P0 Readiness**: ~21% complete before implementation

---

## 📋 EXECUTION OVERVIEW

| PR | Scope | Dependencies | Demo Ready? | Architecture Sources |
|---|---|---|---|
| **PR #1: P0-A** | Capsule Runtime + Tabs | None | UI/Capsules.md, UI/CapsuleProtocol.md |
| **PR #2: P0-B** | Canvas Protocol + Renderer | PR #1 | UI/CanvasProtocol.md |
| **PR #3: P0-C** | Frameworks (Mini-Apps) | PR #1 | UI/MiniAppRuntime.md, spec/FrameworkRegistry.md |
| **PR #4: P0-D** | Kernel Contracts | PR #1, PR #2, PR #3 | UNIFIED/RUNTIME/Kernel.md, UI/PresentationKernel.md |

---

## 📦 PR #1: P0-A — CAPSULE RUNTIME + TABS

**Purpose**: Implement capsule instance management system with tab UI and persistence

### Task Breakdown (7 tasks, ~13.5 hours)

#### Task A1-1: Implement CapsuleStore
**Location**: `apps/shell/src/runtime/CapsuleStore.ts`
**Dependencies**: None
**Est. Time**: 2 hours

**Implementation**:
```typescript
import { CapsuleInstance } from '../../shared/contracts';

export interface CapsuleStore {
  // Read operations
  getAll(): CapsuleInstance[];
  getById(capsuleId: string): CapsuleInstance | null;
  getByFrameworkId(frameworkId: string): CapsuleInstance[];
  
  // Write operations
  spawn(frameworkId: string, title?: string): CapsuleInstance;
  activate(capsuleId: string): void;
  close(capsuleId: string): void;
  
  // Persistence
  setPersistence(capsuleId: string, mode: 'ephemeral' | 'docked' | 'pinned'): void;
  getPersistentCapsules(): CapsuleInstance[];
  getPinnedCapsules(): CapsuleInstance[];
}
```

**Sources**: UI/Capsules.md, UI/CapsuleProtocol.md
**Acceptance**: Store persists, persistence modes work

#### Task A1-2: Implement TabBar Component
**Location**: `apps/shell/src/components/TabBar.tsx`
**Dependencies**: A1-1
**Est. Time**: 3 hours

**Implementation**: Tab UI with capsule title, active state, persistence indicators, close/pin actions

**Sources**: UI/Capsules.md, UI/CapsuleProtocol.md
**Acceptance**: Tabs render, close works, persistence visible

#### Task A1-3: Implement CanvasArea Component
**Location**: `apps/shell/src/components/CanvasArea.tsx`
**Dependencies**: A1-1
**Est. Time**: 2 hours

**Implementation**: Placeholder when no capsule active, mount point for canvas renderer
**Sources**: UI/Capsules.md
**Acceptance**: Mounts canvas, handles state changes

#### Task A1-4: Implement CommandBar Component
**Location**: `apps/shell/src/components/CommandBar.tsx`
**Dependencies**: None
**Est. Time**: 1.5 hours

**Implementation**: Input field with submit button, focus management
**Sources**: UI/Journal.md
**Acceptance**: Captures intent, submits to handler

#### Task A1-5: Implement Shell State Management
**Location**: `apps/shell/src/runtime/ShellState.ts`
**Dependencies**: A1-1
**Est. Time**: 2 hours

**Implementation**: Zustand store for capsules, active capsule, workspace
**Sources**: UI/Capsules.md
**Acceptance**: State persists, actions update correctly

#### Task A1-6: Implement JournalPane Component
**Location**: `apps/shell/src/components/JournalPane.tsx`
**Dependencies**: None (connects to backend in PR #4)
**Est. Time**: 2 hours

**Implementation**: Event stream display, visual distinction, expandable details
**Sources**: UI/Journal.md
**Acceptance**: Events display, loading state handled

#### Task A1-7: Wire Shell Components Together
**Location**: `apps/shell/src/App.tsx`
**Dependencies**: A1-2, A1-3, A1-4, A1-5, A1-6
**Est. Time**: 3 hours

**Implementation**: Integrate all components, handle intent dispatch
**Sources**: All UI architecture files
**Acceptance**: All components render, layout works

**PR #1 Acceptance**:
✅ Shell app runs
✅ Tab bar displays capsules
✅ Command bar captures input
✅ Journal pane renders
✅ State management works

**Repo Anchoring**:
- Modified: `apps/shell/`
- Added: CapsuleStore, TabBar, CanvasArea, CommandBar, JournalPane, ShellState, App
- Unchanged: All other directories

---

## 📦 PR #2: P0-B — CANVAS PROTOCOL + RENDERER

**Purpose**: Implement canvas view types and renderer

### Task Breakdown (8 tasks, ~13 hours)

#### Task B1-1: Define View Registry
**Location**: `apps/ui/src/views/ViewRegistry.ts`
**Est. Time**: 1.5 hours

**Implementation**: Type-safe mapping of ViewType enum to React components

**Sources**: UI/CanvasProtocol.md
**Acceptance**: Registry type-safe, maps correctly

#### Task B1-2: Implement SearchLens View
**Location**: `apps/ui/src/views/SearchLens.tsx`
**Est. Time**: 3 hours

**Implementation**: Search input + results display with binding to query
**Sources**: UI/CanvasProtocol.md, INTEGRATIONS/glide_spec.md
**Acceptance**: Renders search input, displays results, updates state

#### Task B1-3: Implement TimelineView
**Location**: `apps/ui/src/views/TimelineView.tsx`
**Est. Time**: 2.5 hours

**Implementation**: Chronological event display with visual distinction
**Sources**: UI/CanvasProtocol.md, UI/Journal.md
**Acceptance**: Renders events, timestamps formatted correctly

#### Task B1-4: Implement ObjectView
**Location**: `apps/ui/src/views/ObjectView.tsx`
**Est. Time**: 2 hours

**Implementation**: Key-value pair display, handles nested objects
**Sources**: UI/CanvasProtocol.md
**Acceptance**: Renders key-value pairs, displays JSON cleanly

#### Task B1-5: Implement ListView
**Location**: `apps/ui/src/views/ListView.tsx`
**Est. Time**: 2 hours

**Implementation**: Table with headers, row rendering, data binding
**Sources**: UI/CanvasProtocol.md, UI/MiniAppRuntime.md
**Acceptance**: Renders table, handles empty data

#### Task B1-6: Implement CanvasRenderer
**Location**: `apps/ui/src/CanvasRenderer.tsx`
**Est. Time**: 3 hours

**Implementation**: Canvas title, view dispatch based on type
**Sources**: UI/CanvasProtocol.md
**Acceptance**: Renders canvas, dispatches to views, handles unknown types

#### Task B1-7: Add CanvasRenderer to ViewRegistry
**Location**: Update B1-1
**Est. Time**: 0.5 hours

**Implementation**: Export all view components from ViewRegistry
**Sources**: B1-1 through B1-6
**Acceptance**: All view types registered

#### Task B1-8: Export CanvasRenderer from apps/ui
**Location**: `apps/ui/src/index.ts`
**Est. Time**: 0.5 hours

**Implementation**: Export CanvasRenderer and types
**Sources**: All previous tasks
**Acceptance**: Component exported, types exported

**PR #2 Acceptance**:
✅ ViewRegistry maps all view types
✅ All view implementations complete
✅ CanvasRenderer dispatches correctly
✅ Component exported

**Repo Anchoring**:
- Modified: `apps/ui/src/`
- Added: ViewRegistry, SearchLens, TimelineView, ObjectView, ListView, CanvasRenderer, index exports
- Unchanged: All other directories

---

## 📦 PR #3: P0-C — FRAMEWORKS (MINI-APP TEMPLATES)

**Purpose**: Implement framework registry and agent-generated mini-app templates

### Task Breakdown (7 tasks, ~15.5 hours)

#### Task C1-1: Create Framework Service in Rust
**Location**: `services/framework/src/main.rs`
**Dependencies**: None
**Est. Time**: 4 hours

**Implementation**: FrameworkSpec struct, in-memory registry, list/get/register operations
**Sources**: spec/FrameworkRegistry.md, UI/MiniAppRuntime.md
**Acceptance**: FrameworkSpec matches spec, registry stores/retrieves

#### Task C1-2: Implement Framework Templates (Search, Note, Home)
**Location**: `services/framework/src/templates/mod.rs`
**Dependencies**: C1-1
**Est. Time**: 3 hours

**Implementation**: Three frameworks with correct structure (search, note, home)
**Sources**: UI/MiniAppRuntime.md, UI/caspuleshell_kernelcontractsPrompt.md
**Acceptance**: Three frameworks defined, can be registered

#### Task C1-3: Create HTTP Endpoints
**Location**: `services/framework/src/routes.rs`
**Dependencies**: C1-1, C1-2
**Est. Time**: 3 hours

**Implementation**: Axum routes for listing and getting frameworks
**Sources**: UI/caspuleshell_kernelcontractsPrompt.md, Architecture/UNIFIED/RUNTIME/Kernel.md
**Acceptance**: HTTP endpoints work, error handling correct

#### Task C1-4: Add Framework Module to Workspace Cargo.toml
**Location**: `/packages/sdk-apps/Cargo.toml` (add to existing)
**Est. Time**: 0.5 hours

**Implementation**: Add framework-service dependency
**Sources**: Cargo workspace structure
**Acceptance**: Module compiles, dependencies resolve

#### Task C1-5: Create Local Framework Registry UI
**Location**: `apps/shell/src/components/FrameworkRegistry.tsx`
**Dependencies**: A1-5, C1-3
**Est. Time**: 3 hours

**Implementation**: Display all frameworks, fetch from backend on load
**Sources**: spec/FrameworkRegistry.md
**Acceptance**: Displays frameworks, fetches on load

#### Task C1-6: Update Shell to Fetch Frameworks on Startup
**Location**: Update A1-7
**Est. Time**: 1 hour

**Implementation**: Fetch frameworks in useEffect, store in state
**Sources**: UI/caspuleshell_kernelcontractsPrompt.md
**Acceptance**: Frameworks fetched, intent dispatch updated

#### Task C1-7: Integrate Framework Service into Main Application
**Location**: `services/framework/src/main.rs` (entry point)
**Dependencies**: C1-1, C1-3
**Est. Time**: 1 hour

**Implementation**: Tokio main, HTTP server, framework routes
**Sources**: All framework tasks
**Acceptance**: Service runs, routes accessible

**PR #3 Acceptance**:
✅ Framework service runs on HTTP
✅ Three frameworks registered
✅ Shell fetches on startup
✅ Intent routing selects framework
✅ UI displays frameworks

**Repo Anchoring**:
- Modified: `services/framework/` (entire new service), `packages/sdk-apps/`, `apps/shell/src/App.tsx`
- Added: Framework service, templates, HTTP endpoints, SDK update, framework registry UI
- Unchanged: All other directories

---

## 📦 PR #4: P0-D — KERNEL CONTRACTS

**Purpose**: Implement intent dispatcher, tool execution, and journal backend

### Task Breakdown (8 tasks, ~20 hours)

#### Task D1-1: Create Intent Dispatcher Service
**Location**: `services/kernel/src/intent_dispatcher.rs`
**Dependencies**: C1-1
**Est. Time**: 5 hours

**Implementation**: Framework selection, capsule creation, canvas selection, tool execution orchestration
**Sources**: Architecture/UNIFIED/RUNTIME/Kernel.md, UI/PresentationKernel.md, UI/Journal.md
**Acceptance**: Intent parsed to framework ID, capsule created, events/artifacts produced

#### Task D1-2: Create Tool Executor
**Location**: `services/kernel/src/tool_executor.rs`
**Dependencies**: None
**Est. Time**: 3 hours

**Implementation**: Mock executor for v0, web.search tool
**Sources**: Architecture/UNIFIED/RUNTIME/Kernel.md
**Acceptance**: Tool executor instantiated, mock web.search works

#### Task D1-3: Create Journal Ledger Service
**Location**: `packages/history/src/local_journal.rs`
**Dependencies**: None (extends existing history package)
**Est. Time**: 2 hours

**Implementation**: In-memory journal, event/artifact storage, filtering
**Sources**: UI/Journal.md, Architecture/packages/history
**Acceptance**: Journal stores events, artifacts stored separately, filtering works

#### Task D1-4: Create HTTP Endpoints for Kernel
**Location**: `services/kernel/src/routes.rs`
**Dependencies**: D1-1, D1-2, D1-3
**Est. Time**: 3 hours

**Implementation**: Intent dispatch, journal stream, artifact retrieval endpoints
**Sources**: UI/caspuleshell_kernelcontractsPrompt.md, UI/Journal.md
**Acceptance**: POST /v1/intent/dispatch works, GET /v1/journal/stream returns events, GET /v1/artifacts/:id returns artifact

#### Task D1-5: Integrate Kernel into Main Application
**Location**: `services/kernel/src/main.rs`
**Dependencies**: D1-1, D1-2, D1-3, D1-4
**Est. Time**: 1.5 hours

**Implementation**: Tokio main, initialize services, HTTP server, routes
**Sources**: All kernel tasks
**Acceptance**: Kernel service runs, routes accessible

#### Task D1-6: Update Shell to Dispatch to Kernel
**Location**: Update A1-7
**Est. Time**: 2 hours

**Implementation**: POST to /v1/intent/dispatch, apply response to state
**Sources**: UI/caspuleshell_kernelcontractsPrompt.md
**Acceptance**: Shell calls kernel endpoint, response applied to state

#### Task D1-7: Add Journal Polling to Shell
**Location**: `apps/shell/src/runtime/JournalPoller.ts`
**Dependencies**: D1-4
**Est. Time**: 2 hours

**Implementation**: Poll journal endpoint every 5 seconds, update shell state
**Sources**: D1-4
**Acceptance**: Polls journal, updates state, handles capsule changes

#### Task D1-8: Implement Artifact Display in JournalPane
**Location**: Update A1-6
**Est. Time**: 1.5 hours

**Implementation**: Display artifact links in journal pane, fetch on click
**Sources**: D1-4
**Acceptance**: Artifact links displayed, fetching works

**PR #4 Acceptance**:
✅ Kernel service runs on HTTP
✅ Intent dispatch produces capsule + events + canvas
✅ "search cats" produces ObserveCapsule artifact
✅ "note hello" produces note journal event
✅ Journal stream returns events
✅ Artifacts retrievable
✅ Shell polls journal for updates
✅ Demo works end-to-end

**Repo Anchoring**:
- Modified: `services/kernel/` (entire new service), `packages/history/src/`, `apps/shell/src/App.tsx`, `apps/shell/src/runtime/JournalPoller.ts`, `apps/shell/src/components/JournalPane.tsx`
- Added: Intent dispatcher, tool executor, journal, HTTP endpoints, kernel main, shell integration, journal polling
- Unchanged: All other directories

---

## 🎯 FINAL ACCEPTANCE: DEMO VERIFICATION

### Demo 1: "search cats"

**Expected Flow**:
1. User types "search cats" in command bar
2. Shell dispatches intent to kernel
3. Kernel selects fwk_search framework
4. Kernel executes web.search tool
5. Kernel produces events and ObserveCapsule artifact
6. Shell displays Search capsule tab with canvas
7. Canvas renders search_lens view
8. Journal pane shows all events
9. User can view ObserveCapsule artifact

**Test Command**:
```bash
cd services/framework && cargo run &
cd ../kernel && cargo run &
cd ../../apps/shell && npm run dev
# In shell, type: search cats
```

### Demo 2: "note hello"

**Expected Flow**:
1. User types "note hello" in command bar
2. Shell dispatches intent to kernel
3. Kernel selects fwk_note framework
4. Kernel executes note tool
5. Kernel produces journal events
6. Shell displays Notes capsule tab with canvas
7. Canvas renders list_view with note data
8. Journal pane shows all events
9. Note persisted in journal

**Test Command**: Same services, type: note hello

---

## 📊 SUMMARY

| PR | Tasks | Total Time | Architecture Files |
|---|---|---|---|
| PR #1 | 7 tasks | 13.5 hrs | UI/Capsules.md, UI/CapsuleProtocol.md |
| PR #2 | 8 tasks | 13 hrs | UI/CanvasProtocol.md, INTEGRATIONS/glide_spec.md |
| PR #3 | 7 tasks | 15.5 hrs | UI/MiniAppRuntime.md, spec/FrameworkRegistry.md |
| PR #4 | 8 tasks | 20 hrs | UNIFIED/RUNTIME/Kernel.md, UI/PresentationKernel.md, UI/Journal.md |

**Total**: 30 tasks  
**Total Time**: ~62 hours (~8 full days)  
**Architecture Files Referenced**: 12  
**Sequential PRs**: A → B → C → D

---

## 📍 REPO ANCHORING SUMMARY

**What Will Be Modified**:
- `apps/shell/` — Frontend shell application
- `apps/ui/` — Canvas renderer library
- `services/framework/` — Framework registry service (new)
- `services/kernel/` — Intent dispatch service (new)
- `packages/history/` — Journal persistence

**What Will NOT Be Touched**:
- `crates/` — Existing SDK packages remain unchanged
- `services/gateway/` — Tool gateway not modified for P0
- `services/router-agent/` — Existing router service untouched
- All Python gateways — Not needed for P0

**Why This Anchoring Is Correct**:
1. P0-A and P0-B extend `apps/` (existing frontend structure)
2. P0-C creates new service in `services/` (consistent with existing services)
3. P0-D extends `packages/history/` (existing package)
4. All implementations use existing contracts in `apps/shared/`
5. Each PR adds functionality incrementally without breaking existing code

---

## 🎓 EXECUTION STRATEGY

1. **Sequential PRs**: Each PR has clear, testable scope
2. **No stub code**: Each slice implements real functionality
3. **Demo focus**: Each slice ends with working demo
4. **Sequential delivery**: A→B→C→D matches Architecture corpus order
5. **Easy rollback**: If a slice doesn't work, it can be reverted independently
6. **Architecture citations**: Every PR includes explicit source references
7. **Repo anchoring**: Every PR states what was modified and why

---

## 📝 READY TO EXECUTE

This plan covers:
- ✅ Every single task from start to finish
- ✅ Sequential PRs that build on each other
- ✅ Repo anchoring that respects existing structure
- ✅ Architecture file citations for all work
- ✅ Demo focus (no stub code)
- ✅ Complete feature delivery (two working demos)

**Next Step**: Begin PR #1 implementation when approved.

---

**Created**: 2026-01-09
**Status**: Ready for Execution
