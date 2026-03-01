# A2R UI Architecture: Rails/DAK Unification

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                     ShellApp (Root)                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                    App Header                                       │ │
│  └─────────────────────────────────────────────────────────────────────────────────────┘ │
│  ┌──────────────┐  ┌────────────────────────────────────────────────────────────────┐  │
│  │              │  │                                                                │  │
│  │   Left Rail  │  │                     Main Canvas                               │  │
│  │              │  │                                                                │  │
│  │  ┌────────┐  │  │   ┌────────────────────────────────────────────────────────┐  │  │
│  │  │ Home   │  │  │   │                                                        │  │  │
│  │  │ Browser│  │  │   │              Unified Agent System View                 │  │  │
│  │  │ Chat   │  │  │   │                                                        │  │  │
│  │  └────────┘  │  │   │   ┌────────────────────────────────────────────────┐   │  │  │
│  │  ┌────────┐  │  │   │   │  Tab Bar                                       │   │  │  │
│  │  │Agent   │  │  │   │   │  [Plan] [Work] [Status] [Mail] [Tools] [Audit] │   │  │  │
│  │  │System⭐│  │  │   │   └────────────────────────────────────────────────┘   │  │  │
│  │  │Studio  │  │  │   │                                                        │  │  │
│  │  │Registry│  │  │   │   ┌────────────────────────────────────────────────┐   │  │  │
│  │  └────────┘  │  │   │   │            Active Tab Content                   │   │  │  │
│  │              │  │   │   │                                                   │   │  │  │
│  │  ⭐ = Unified│  │   │   │   • Plan: Templates, DAG Editor, Recent Plans    │   │  │  │
│  │     Entry    │  │   │   │   • Work: WIH Queue, Active Work, Leases        │   │  │  │
│  │              │  │   │   │   • Status: Health, Executions, Events          │   │  │  │
│  │              │  │   │   │   • Mail: Threads, Inbox, Reviews               │   │  │  │
│  │              │  │   │   │   • Tools: Templates, Snapshots, Settings       │   │  │  │
│  │              │  │   │   │   • Audit: Timeline, Receipts, Context Packs    │   │  │  │
│  │              │  │   │   │                                                   │   │  │  │
│  │              │  │   │   └────────────────────────────────────────────────┘   │  │  │
│  │              │  │   │                                                        │  │  │
│  │              │  │   └────────────────────────────────────────────────────────┘  │  │
│  │              │  │                                                                │  │
│  └──────────────┘  └────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                              Console Drawer (Bottom)                                │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │ Tab Bar:                                                                    │   │ │
│  │  │ [Queue] [Terminal] [Logs] [Executions] [Agents] [Scheduler] [Context]      │   │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │ Content Area (Resizable)                                                    │   │ │
│  │  │                                                                             │   │ │
│  │  │ • Queue: Kanban board of WIHs (synced with Work tab)                       │   │ │
│  │  │ • Terminal: Command line interface                                          │   │ │
│  │  │ • Logs: Merged local + Rails events                                         │   │ │
│  │  │ • Executions: DAG run history (synced with Status tab)                      │   │ │
│  │  │ • Agents: Active agents from WIH assignments                               │   │ │
│  │  │ • Scheduler: Cron-based DAG schedules                                       │   │ │
│  │  │ • Context: Current WIH/DAG summary (always visible)                        │   │ │
│  │  │                                                                             │   │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Component Integration Map

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              Data Layer (Zustand Stores)                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                        useUnifiedStore (Single Source of Truth)                  │   │
│  │                                                                                  │   │
│  │  Rails API State:              DAK State:              Context State:           │   │
│  │  ├── dags: DagDefinition[]     ├── templates           ├── currentMode          │   │
│  │  ├── wihs: WihInfo[]           ├── snapshots           ├── selectedWihId        │   │
│  │  ├── leases: ManagedLease[]    ├── receipts            ├── selectedDagId        │   │
│  │  ├── executions: DagRun[]      └── contextPacks        └── contextMetadata      │   │
│  │  ├── mailThreads: Thread[]                                                       │   │
│  │  ├── ledgerEvents: Event[]                                                       │   │
│  │  └── health: SystemHealth                                                        │   │
│  │                                                                                  │   │
│  │  Actions:                                                                        │   │
│  │  ├── fetchWihs(), pickupWih(), closeWih()                                       │   │
│  │  ├── createPlan(), executeDag(), cancelRun()                                    │   │
│  │  ├── requestLease(), renewLease(), releaseLease()                               │   │
│  │  ├── sendMail(), reviewThread()                                                 │   │
│  │  ├── fetchTemplates(), saveSnapshot()                                           │   │
│  │  └── setContext(), clearContext()                                               │   │
│  │                                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                               │
│                    ┌─────────────────────┼─────────────────────┐                        │
│                    │                     │                     │                        │
│                    ▼                     ▼                     ▼                        │
│         ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│         │   Main View     │  │  Console Drawer │  │   Left Rail     │                  │
│         │   (6 tabs)      │  │   (7 tabs)      │  │   (Navigation)  │                  │
│         └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Tab-to-API Mapping

### Main View Tabs

| Tab | Primary API | Secondary APIs | Drawer Sync |
|-----|-------------|----------------|-------------|
| **Plan** | `POST /v1/plan` | `GET /v1/plans`, `POST /v1/plan/refine` | DAG selection syncs to Context tab |
| **Work** | `POST /v1/wihs` | `POST /v1/wihs/pickup`, `POST /v1/wihs/{id}/close` | WIH selection syncs to Queue tab |
| **Status** | `GET /health` | `GET /v1/leases`, `POST /v1/ledger/tail` | Health/executions sync to Executions tab |
| **Mail** | `GET /v1/mail/inbox` | `POST /v1/mail/threads`, `POST /v1/mail/send` | New mail triggers badge |
| **Tools** | Local DAK | `GET /v1/context-packs` | Snapshots shared with drawer |
| **Audit** | `POST /v1/ledger/trace` | `GET /v1/receipts` | Events feed to Logs tab |

### Console Drawer Tabs

| Tab | Source | API Integration | Bidirectional Sync |
|-----|--------|-----------------|-------------------|
| **Queue** | Unified Store | `POST /v1/wihs` | WIH click → opens Work tab |
| **Terminal** | Local | Extensible for Rails CLI | Commands can trigger store actions |
| **Logs** | Unified Store | `POST /v1/ledger/tail` + execEvents | Merged view |
| **Executions** | Unified Store | `GET /v1/plans` + execution data | Run click → opens Plan tab |
| **Agents** | Unified Store | Derived from WIH assignees | Agent click → filter Work tab |
| **Scheduler** | Unified Store | Scheduled DAG queries | Job click → opens Plan tab |
| **Context** | Unified Store | Current selection from store | Always in sync |

## Navigation Flow

```
User Action Flow:
─────────────────

1. OPEN AGENT SYSTEM
   ┌─────────┐     ┌─────────────────┐     ┌─────────────────────┐
   │ Left    │────▶│ ShellApp        │────▶│ UnifiedView         │
   │ Rail    │     │ opens 'rails'   │     │ with default tab    │
   │ Click   │     │ view            │     │ (Plan or last used) │
   └─────────┘     └─────────────────┘     └─────────────────────┘

2. CREATE DAG PLAN
   ┌─────────────────────┐     ┌─────────────────┐     ┌─────────────────────┐
   │ Plan Tab            │────▶│ unifiedStore.   │────▶│ POST /v1/plan       │
   │ Natural Language    │     │ createPlan()    │     │ Rails API           │
   │ Submit              │     │                 │     │                     │
   └─────────────────────┘     └─────────────────┘     └─────────────────────┘
                                          │
                                          ▼
                              ┌─────────────────────┐
                              │ Store updates dags[]│
                              │ UI auto-refreshes   │
                              └─────────────────────┘

3. PICKUP WORK
   ┌─────────────────────┐     ┌─────────────────┐     ┌─────────────────────┐
   │ Work Tab            │────▶│ unifiedStore.   │────▶│ POST /v1/wihs/pickup│
   │ Click "Pickup"      │     │ pickupWih()     │     │ Rails API           │
   │ on WIH              │     │                 │     │                     │
   └─────────────────────┘     └─────────────────┘     └─────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
         ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
         │ Work Tab shows  │  │ Context banner  │  │ Drawer Context  │
         │ active WIH      │  │ updates         │  │ tab updates     │
         └─────────────────┘  └─────────────────┘  └─────────────────┘

4. SWITCH TO DRAWER
   ┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
   │ ConsoleDrawer       │────▶│ Click WIH in Queue  │────▶│ Sync to Main View   │
   │ Open Queue tab      │     │ tab                 │     │ opens Work tab      │
   └─────────────────────┘     └─────────────────────┘     └─────────────────────┘

5. COMPLETE WORK
   ┌─────────────────────┐     ┌─────────────────┐     ┌─────────────────────┐
   │ Any View            │────▶│ unifiedStore.   │────▶│ POST /v1/wihs/close │
   │ Click "Complete"    │     │ closeWih()      │     │ Rails API           │
   └─────────────────────┘     └─────────────────┘     └─────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
         ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
         │ WIH removed     │  │ Context cleared │  │ Queue updated   │
         │ from active     │  │ or next WIH     │  │ (Kanban moves   │
         │                 │  │ shown           │  │ to Done)        │
         └─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Context State Machine

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Context States                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    ┌──────────┐                                                                │
│    │   IDLE   │◄─────────────────────────────────────────────────────┐         │
│    │  (none)  │                                                      │         │
│    └────┬─────┘                                                      │         │
│         │                                                            │         │
│         │ 1. Select DAG from Plan tab                                │         │
│         │ 2. Create new plan                                         │         │
│         ▼                                                            │         │
│    ┌──────────┐     ┌──────────┐     ┌──────────┐                   │         │
│    │ PLANNING │────▶│ EXECUTING│────▶│REVIEWING │───────────────────┘         │
│    │          │     │          │     │          │                             │
│    │ Selected │     │ DAG      │     │ Pending  │                             │
│    │ DAG      │     │ running  │     │ review   │                             │
│    └──────────┘     └────┬─────┘     └──────────┘                             │
│                          │                                                     │
│                          │ 3. Pickup WIH                                      │
│                          ▼                                                     │
│                   ┌──────────┐                                                 │
│                   │ WORKING  │                                                 │
│                   │          │                                                 │
│                   │ Active   │                                                 │
│                   │ WIH      │                                                 │
│                   └────┬─────┘                                                 │
│                        │                                                       │
│                        │ 4. Close WIH                                          │
│                        ▼                                                       │
│                   ┌──────────┐                                                 │
│                   │COMPLETED │────────────────────────────────────────────────►│
│                   │          │                                                 │
│                   │ WIH done │                                                 │
│                   └──────────┘                                                 │
│                                                                                  │
│  Context Transitions:                                                            │
│  • Any state → IDLE: User clears context                                         │
│  • PLANNING → EXECUTING: User executes DAG                                       │
│  • EXECUTING → WORKING: WIH picked up by agent                                   │
│  • WORKING → REVIEWING: WIH requires review                                      │
│  • WORKING → COMPLETED: WIH closed                                               │
│  • REVIEWING → EXECUTING: Review approved, continues                             │
│  • REVIEWING → IDLE: Review rejected, work stops                                 │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## File Dependencies

```
Dependency Graph:
─────────────────

shell/
├── ShellApp.tsx
│   ├── imports: ConsoleDrawer, ShellRail, ViewHost
│   ├── viewRegistry: { rails: UnifiedView }
│   └── global providers
│
├── ConsoleDrawer.tsx
│   └── delegates to: views/code/ConsoleDrawer/DrawerRoot.tsx
│
└── rail/
    ├── rail.config.ts ──────┐
    ├── code.config.ts ──────┼──► imported by ShellRail.tsx
    └── cowork.config.ts ────┘

views/
├── AgentSystemView/              ◄── NEW unified view
│   ├── index.tsx
│   ├── TabBar.tsx
│   ├── tabs/
│   │   ├── PlanTab.tsx
│   │   ├── WorkTab.tsx
│   │   ├── StatusTab.tsx
│   │   ├── MailTab.tsx
│   │   ├── ToolsTab.tsx
│   │   └── AuditTab.tsx
│   └── hooks/
│       └── useAgentSystem.ts
│
├── code/
│   └── ConsoleDrawer/
│       ├── DrawerRoot.tsx        ◄── UPDATE: add Context tab
│       ├── DrawerTabs.tsx        ◄── UPDATE: new tab definitions
│       ├── KanbanBoard.tsx       ◄── UPDATE: useUnifiedStore
│       ├── RunsView.tsx          ◄── UPDATE: useUnifiedStore
│       ├── OrchestrationView.tsx ◄── UPDATE: useUnifiedStore
│       └── SchedulerView.tsx     ◄── UPDATE: useUnifiedStore
│
├── RailsView.tsx                 ◄── DEPRECATED (remove after migration)
├── RunnerView.tsx                ◄── DEPRECATED (remove after migration)
└── AgentView.tsx                 ◄── KEEP (Agent Studio)

lib/
└── agents/
    ├── rails.service.ts          ◄── HTTP client for Rails API
    ├── dak.store.ts              ◄── MERGE into unified.store.ts
    ├── unified.store.ts          ◄── NEW single source of truth
    └── index.ts                  ◄── Export types

State Dependencies:
───────────────────

useUnifiedStore (new)
├── rails.service.ts (injected)
├── localStorage (persist context)
└── subscribe pattern for drawer sync

DrawerRoot
├── useUnifiedStore (subscribe to context)
└── DrawerContext (React context for UI state)

AgentSystemView
├── useUnifiedStore (primary state)
├── TabBar (local UI state)
└── Individual tabs (derive from store)
```

## Responsive Behavior

```
Breakpoints:
─────────────

Desktop (≥1200px):
┌────────────────────────────────────────────────────────────────────────┐
│ Left Rail (300px) │ Main View (flex) │ Right Panel (optional, 350px)  │
└────────────────────────────────────────────────────────────────────────┘

Tablet (768px - 1199px):
┌────────────────────────────────────────────────────┐
│ ◀ Collapsible Rail │ Main View (full width)        │
└────────────────────────────────────────────────────┘

Mobile (<768px):
┌────────────────────────────────────────────────────┐
│ ▤ Menu │ Main View (full width)                    │
└────────────────────────────────────────────────────┘
│  Bottom Sheet (Console Drawer)                     │
└────────────────────────────────────────────────────┘

Console Drawer Height States:
─────────────────────────────

Collapsed:  0px   (handle only)
Compact:    150px (1-2 list items)
Default:    300px (comfortable viewing)
Expanded:   600px (full workspace)
Fullscreen: 100vh - header (immersive)
```

## API Call Patterns

```
Polling Strategy:
─────────────────

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   High Frequency│     │  Medium Frequency│     │   Low Frequency │
│   (5 seconds)   │     │  (30 seconds)    │     │   (5 minutes)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
│                 │     │                 │     │                 │
├── WIH list      │     ├── DAG list      │     ├── Templates     │
├── Active runs   │     ├── Lease status  │     ├── Snapshots     │
├── Health check  │     ├── Mail threads  │     └── Settings      │
└── Notifications │     └── Agent status  │                     │
                      │                 │                     │
                      └─────────────────┘                     │
                                                              │
┌─────────────────┐                                           │
│  Real-time      │◀──────────────────────────────────────────┘
│  (WebSocket)    │
└─────────────────┘
│
├── Ledger events (append-only)
├── WIH status changes
└── New mail messages
```

## Summary

This architecture provides:

1. **Single Source of Truth**: Unified store eliminates data duplication
2. **Bidirectional Sync**: Main view and drawer stay synchronized
3. **Context-Aware UI**: Tabs adapt to current work context
4. **Progressive Disclosure**: Drawer for quick access, main view for deep work
5. **Consistent Navigation**: Clear mental model for users

The key integration points are:
- **useUnifiedStore**: Central state management
- **Context State**: Tracks current WIH/DAG across all views
- **Rail Consolidation**: Single "Agent System" entry point
- **Drawer Sync**: Real-time updates via store subscriptions
