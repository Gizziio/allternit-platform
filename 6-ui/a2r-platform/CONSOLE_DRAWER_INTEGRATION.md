# Console Drawer Integration Analysis

## Current Drawer Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  ConsoleDrawer (Global - always visible at bottom)                   │
├─────────────────────────────────────────────────────────────────────┤
│  Tab Bar:  [Kanban] [Terminal] [Logs] [Runs] [Problems] [Agents] [Scheduler] │
├─────────────────────────────────────────────────────────────────────┤
│  Content Area (resizable height)                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Current Tabs Analysis

| Tab | Component | Current State | Rails/DAK Relevance | Action Needed |
|-----|-----------|---------------|---------------------|---------------|
| **Kanban** | `KanbanBoard` | Uses `useDagState` (local) | HIGH - DAG node visualization | Wire to Rails WIH/DAG API |
| **Terminal** | `TerminalView` | Static mock | MEDIUM - Could execute Rails CLI | Add Rails command integration |
| **Logs** | `LogsView` | Real via `execEvents` | MEDIUM - Should include Rails logs | Extend to capture Rails events |
| **Runs** | `RunsView` | **MOCK DATA** | HIGH - DAG execution history | Replace with Rails API |
| **Problems** | `ProblemsView` | Static mock | LOW - Code errors | Keep or integrate with Rails health |
| **Agents** | `OrchestrationView` | Uses `useAgentStore` (mock) | HIGH - Agent status | Wire to Rails WIH/agent API |
| **Scheduler** | `SchedulerView` | Mix mock + kernel jobs | HIGH - Job scheduling | Align with Rails scheduler |

---

## Integration Architecture

```
                    ┌──────────────────────────────────────────┐
                    │           ShellApp (Root)                │
                    └──────────────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
           ▼                         ▼                         ▼
   ┌───────────────┐      ┌──────────────────┐      ┌──────────────────┐
   │   Left Rail   │      │   Main Canvas    │      │  Console Drawer  │
   │  (Navigation) │      │  (Active View)   │      │   (Quick Access) │
   └───────────────┘      └──────────────────┘      └──────────────────┘
           │                         │                         │
           │                         ▼                         │
           │              ┌──────────────────┐                 │
           │              │  UnifiedView     │                 │
           │              │  (6 tabs)        │                 │
           │              │  - Plan          │                 │
           │              │  - Work          │                 │
           │              │  - Status        │                 │
           │              │  - Mail          │                 │
           │              │  - Tools         │                 │
           │              │  - Audit         │                 │
           │              └──────────────────┘                 │
           │                         ▲                         │
           │                         │                         │
           └───────────────┬─────────┴─────────┬───────────────┘
                           │                   │
                           ▼                   ▼
              ┌─────────────────────┐  ┌─────────────────────┐
              │   useUnifiedStore   │  │   DrawerContext     │
              │   (Zustand)         │  │   (Context API)     │
              └─────────────────────┘  └─────────────────────┘
                           │                   │
                           └─────────┬─────────┘
                                     ▼
                    ┌──────────────────────────────────┐
                    │        Rails API (Gateway)       │
                    │   (DAGs, WIHs, Leases, Mail...)  │
                    └──────────────────────────────────┘
```

---

## Proposed Drawer Redesign

### Option A: Contextual Drawer Tabs (Recommended)

```
Drawer tabs change based on active main view context:

When in "Plan" context:
  [Templates] [Recent Plans] [DAG Preview] [Terminal]

When in "Work" context:
  [WIH Queue] [My Active] [Leases] [Context Pack] [Terminal]

When in "Status" context:
  [Health] [Active Runs] [Logs] [Events] [Terminal]

When in "Mail" context:
  [Inbox] [Threads] [Reviews] [Terminal]
```

### Option B: Fixed Tabs with Contextual Content

```
Fixed tabs, but content adapts:

[Queue] [Executions] [Agents] [Logs] [Terminal] [Context]

- Queue: Shows WIHs or DAG nodes based on context
- Executions: Shows runs for current DAG or all
- Agents: Shows agents working on current context
- Context: Always shows current WIH/DAG details
```

---

## Detailed Wiring Plan

### 1. Kanban Board → Rails WIH Integration

**Current:** Uses local `useDagState` with mock nodes
**Target:** Display real WIHs from Rails API

```typescript
// Kanban columns map to WIH states
const COLUMN_MAP = {
  'pending':  'ready',      // WIHs ready for pickup
  'ready':    'ready',      // WIHs ready for pickup
  'running':  'in_progress', // Active WIHs
  'blocked':  'blocked',    // WIHs with unresolved deps
  'review':   'review',     // WIHs pending review
  'completed': 'completed'  // Closed WIHs
};
```

**Implementation:**
- Replace `useDagState` with `useUnifiedStore`
- Fetch WIHs via `railsApi.wihs.list()`
- Map WIH status to kanban columns
- Allow drag-drop to change WIH status

### 2. Runs View → Rails Executions

**Current:** MOCK_RUNS array
**Target:** Real DAG execution history

```typescript
// Fetch from Rails API
const executions = await railsApi.plan.list(); // Get all DAGs
const runs = await railsApi.ledger.tail({ dag_id: selectedDagId });
```

### 3. Orchestration View → Rails Agent Status

**Current:** Uses `useAgentStore` (mock agents)
**Target:** Show agents from Rails WIH pickups

```typescript
// Agents = entities that have picked up WIHs
const activeAgents = wihs
  .filter(w => w.assignee)
  .map(w => ({
    id: w.assignee,
    name: w.assignee_name,
    currentTask: w,
    status: w.status === 'in_progress' ? 'Working' : 'Waiting'
  }));
```

### 4. Scheduler → Rails Job Alignment

**Current:** Mix of mock + kernel jobs
**Target:** Integrate with Rails scheduled DAG executions

```typescript
// Rails scheduled jobs
const scheduledJobs = await railsApi.plan.list({ scheduled: true });
```

---

## Left Rail Consolidation

### Current Agents Section

```typescript
// rail.config.ts - Current
{
  id: 'agents',
  title: 'Agents',
  items: [
    { id: 'agent', label: 'Agent Studio', icon: Robot, payload: 'agent' },
    { id: 'rails', label: 'Rails System', icon: Train, payload: 'rails' },  // ← REMOVE
    { id: 'runner', label: 'Runner', icon: Robot, payload: 'runner' },       // ← REMOVE
    { id: 'registry', label: 'Agent Registry', icon: ShieldCheck, payload: 'registry' },
    { id: 'memory', label: 'Memory', icon: Brain, payload: 'memory' },
  ]
}
```

### Proposed Agents Section

```typescript
// rail.config.ts - Proposed
{
  id: 'agents',
  title: 'Agents',
  items: [
    { id: 'agent', label: 'Agent Studio', icon: Robot, payload: 'agent' },
    { id: 'rails', label: 'Agent System', icon: Train, payload: 'rails' },  // ← UNIFIED
    { id: 'registry', label: 'Agent Registry', icon: ShieldCheck, payload: 'registry' },
    { id: 'memory', label: 'Memory', icon: Brain, payload: 'memory' },
  ]
}
```

### Code Mode Rail Updates

```typescript
// code.config.ts - Add quick access to unified view
{
  id: 'execution',
  title: 'Execution',
  items: [
    { id: 'cd-runs', label: 'Runs', icon: ClockCounterClockwise, payload: 'rails' }, // ← POINT TO UNIFIED
    { id: 'cd-terminal', label: 'Terminal', icon: TerminalWindow, payload: 'terminal' },
    { id: 'cd-queue', label: 'Work Queue', icon: List, payload: 'rails' }, // ← NEW
  ]
}
```

---

## New DAG Nodes for Drawer Integration

```yaml
# Phase 7: Console Drawer Integration
nodes:
  - id: n_0601
    title: Audit Drawer Views
    type: analysis
    description: |
      Analyze all 7 drawer tabs for Rails/DAK integration potential.
      Document current data sources and target integration points.
    acceptance: |
      - Matrix of all drawer tabs vs Rails/DAK APIs
      - Decision on which tabs to keep/modify/remove
      - Integration priority list
    role: architect
    
  - id: n_0602
    title: Wire Kanban to Rails WIH
    type: implementation
    description: |
      Replace useDagState with useUnifiedStore in KanbanBoard.
      Map WIH statuses to kanban columns.
      Enable drag-drop status changes.
    acceptance: |
      - Kanban shows real WIHs from Rails API
      - Columns: Backlog, Ready, In Progress, Blocked, Review, Done
      - Dragging updates WIH status via API
      - Auto-refresh on WIH changes
    dependencies: [n_0101]  # Requires unified store
    role: frontend
    
  - id: n_0603
    title: Replace Runs View with Real Data
    type: implementation
    description: |
      Replace MOCK_RUNS in RunsView with Rails API calls.
      Show DAG execution history with status, duration, timestamps.
    acceptance: |
      - No mock data in RunsView
      - Shows real DAG executions from Rails
      - Includes execution status, duration, timestamps
      - Re-run button works
    dependencies: [n_0101]
    role: frontend
    
  - id: n_0604
    title: Wire Orchestration View to Rails
    type: implementation
    description: |
      Replace useAgentStore with useUnifiedStore in OrchestrationView.
      Show agents based on WIH assignments.
    acceptance: |
      - Shows agents with active WIH assignments
      - Real-time status updates
      - Current task display from WIH data
    dependencies: [n_0101]
    role: frontend
    
  - id: n_0605
    title: Align Scheduler with Rails
    type: implementation
    description: |
      Integrate SchedulerView with Rails scheduled DAGs.
      Show cron-based DAG executions.
    acceptance: |
      - Lists scheduled DAGs from Rails
      - Shows cron expressions
      - Pause/resume functionality
      - Last run / next run timestamps
    dependencies: [n_0101]
    role: frontend
    
  - id: n_0606
    title: Add Context Tab to Drawer
    type: implementation
    description: |
      Create new "Context" tab that always shows current
      WIH/DAG context regardless of other drawer tabs.
    acceptance: |
      - Context tab shows active WIH details
      - Shows assigned DAG if applicable
      - Quick actions (view in main, release, etc.)
      - Updates when context changes
    dependencies: [n_0301]  # Requires context state mgmt
    role: frontend
    
  - id: n_0607
    title: Implement Drawer/Main View Sync
    type: implementation
    description: |
      Create bidirectional sync between drawer and main view:
      - Selecting WIH in drawer → opens Work tab
      - Selecting DAG in drawer → opens Plan tab
      - Context changes propagate both ways
    acceptance: |
      - Clicking WIH in drawer opens Work tab
      - Context changes sync immediately
      - No state drift between views
    dependencies: [n_0602, n_0606]
    role: frontend

# Phase 8: Left Rail Consolidation
nodes:
  - id: n_0701
    title: Create Unified Rail Entry
    type: implementation
    description: |
      Update rail.config.ts to replace separate
      "Rails System" and "Runner" with single "Agent System" entry.
    acceptance: |
      - Single "Agent System" entry in Agents section
      - Icon: Train or GitBranch
      - Opens unified view
    dependencies: [n_0402]  # After navigation updates
    role: frontend
    
  - id: n_0702
    title: Update Code Mode Rail
    type: implementation
    description: |
      Update code.config.ts:
      - Point execution items to unified view
      - Add Work Queue quick access
    acceptance: |
      - Runs → unified view
      - Work Queue → unified view Work tab
      - Terminal stays as-is
    dependencies: [n_0701]
    role: frontend
    
  - id: n_0703
    title: Remove Deprecated Rail Entries
    type: cleanup
    description: |
      Remove old rail entries after migration:
      - Remove separate runner entry
      - Update any hardcoded references
    acceptance: |
      - No duplicate navigation entries
      - All rail items functional
    dependencies: [n_0702]
    role: developer
```

---

## File Structure After Integration

```
src/
├── shell/
│   ├── rail/
│   │   ├── rail.config.ts           # Updated with unified entry
│   │   ├── code.config.ts           # Updated execution section
│   │   └── cowork.config.ts
│   ├── ShellApp.tsx                 # Remove separate runner view registration
│   ├── ShellRail.tsx                # No changes needed
│   └── ConsoleDrawer.tsx            # Delegates to DrawerRoot
│
├── views/
│   ├── code/
│   │   └── ConsoleDrawer/
│   │       ├── DrawerRoot.tsx       # Update renderContent switch
│   │       ├── DrawerTabs.tsx       # Update tab definitions
│   │       └── ...
│   │   ├── KanbanBoard.tsx          # Wire to unified store
│   │   ├── RunsView.tsx             # Wire to unified store
│   │   ├── OrchestrationView.tsx    # Wire to unified store
│   │   └── SchedulerView.tsx        # Wire to unified store
│   │
│   ├── AgentSystemView/             # NEW - Unified view (replaces RailsView+RunnerView)
│   │   ├── index.tsx
│   │   ├── components/
│   │   │   ├── TabBar.tsx           # 6 tabs: Plan, Work, Status, Mail, Tools, Audit
│   │   │   ├── PlanTab.tsx
│   │   │   ├── WorkTab.tsx
│   │   │   ├── StatusTab.tsx
│   │   │   ├── MailTab.tsx
│   │   │   ├── ToolsTab.tsx
│   │   │   └── AuditTab.tsx
│   │   └── hooks/
│   │       └── useAgentSystem.ts    # Local hook for view logic
│   │
│   ├── RailsView.tsx                # DEPRECATED - remove after migration
│   ├── RunnerView.tsx               # DEPRECATED - remove after migration
│   └── AgentView.tsx                # Keep - Agent Studio for config
│
├── lib/
│   └── agents/
│       ├── rails.service.ts         # Rails API client
│       ├── dak.store.ts             # DAK store (merge into unified)
│       ├── unified.store.ts         # NEW - Unified store
│       └── index.ts                 # Type exports
│
└── App.tsx                          # No changes needed
```

---

## Quick Reference: Component Mapping

| Drawer Component | Current Store | Target Store | Rails API Endpoint |
|------------------|---------------|--------------|-------------------|
| KanbanBoard | useDagState | useUnifiedStore | POST /v1/wihs |
| RunsView | MOCK | useUnifiedStore | GET /v1/plans |
| OrchestrationView | useAgentStore | useUnifiedStore | POST /v1/wihs |
| SchedulerView | mock + kernel | useUnifiedStore | GET /v1/plans?scheduled=true |
| LogsView | execEvents | useUnifiedStore | POST /v1/ledger/tail |

---

## Summary

The ConsoleDrawer is a **global quick-access surface** that should complement the main unified view. Key integration points:

1. **Drawer tabs should show real Rails data** (not mocks)
2. **Drawer and main view share unified store** for consistency
3. **Context sync** enables seamless workflow between drawer and main view
4. **Left rail consolidates** to single "Agent System" entry
5. **Code mode rail** gets quick access to work queue and runs

This creates a cohesive experience where:
- **Left Rail**: Navigation to major sections
- **Main View**: Deep work on current context (Plan/Work/Mail/etc.)
- **Console Drawer**: Quick access to queue, runs, agents, and context details
