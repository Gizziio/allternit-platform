# Absorption Plan: Multica + Taskdog → Allternit Cowork

> **STATUS:** Draft — pending review  
> **DATE:** 2026-04-18  
> **SCOPE:** Fork, rename, and surgically integrate `multica-ai/multica` and `Kohei-Wada/taskdog` into the Allternit monorepo.

---

## 0. Codebase Reality Check (What We Actually Have)

Before integration, we must acknowledge what exists to avoid collisions:

| System | Location | Tech | What It Already Does |
|--------|----------|------|---------------------|
| **Platform UI** | `surfaces/allternit-platform/` | Next.js 15 App Router | `(platform)/marketplace`, `(platform)/workflows`, `app/shell/*`, `app/terminal/*` |
| **Cowork Views** | `surfaces/allternit-platform/src/views/cowork/` | React + Zustand | `CoworkStore.ts`, `TasksView.tsx`, `RunsView.tsx`, `CronView.tsx`, `CoworkLaunchpad.tsx`, `CoworkRoot.tsx`, `cowork.types.ts` |
| **Agent System** | `surfaces/allternit-platform/src/lib/agents/` | TypeScript/Zustand | `agent.store.ts` (full CRUD, runs, tasks, queue, mail, gates), `agent-cron-scheduler.ts`, `agent-cowork-integration.ts`, `agent.service.ts` |
| **Task Dock** | `surfaces/allternit-platform/src/dock/TaskDock.tsx` | React | Floating/panel task UI with ticket store |
| **Gizzi TUI** | `cmd/gizzi-code/` | TypeScript / Ink | `src/screens/`, `src/ink/`, `src/scheduler/TaskScheduler.ts`, `src/skills/bundled/`, `src/runtime/` |
| **Cowork Controller** | `cmd/gizzi-code/packages/cowork-controller/` | TypeScript | Package for cowork control |
| **Plugin SDK** | `packages/@allternit/plugin-sdk/` | TypeScript | Plugin manifest, runtime, examples |
| **Rust Scheduler** | `infrastructure/scheduler/` | Rust (sqlx, SQLite) | Cron parser, daemon, schedule CRUD with misfire handling |
| **Cowork Executor** | `infrastructure/executor/cowork/` | TypeScript + native | Drivers (Apple VF, Firecracker), transport (vsock, virtio), image manager |
| **Kernel Service** | `services/orchestration/orchestration/kernel-service/` | Rust | `agent_registry.rs`, `taskgraph.rs`, `intent_dispatcher.rs`, `session_manager.rs` |
| **Registry Services** | `services/registry/` | Rust | `server-registry`, `apps-registry`, `framework-registry`, `functions-registry` |

**Critical Constraint:** Gizzi Code is an **Ink (React for Terminal) TUI in TypeScript**. Taskdog is a **Rust TUI**. We **cannot** absorb Taskdog's Rust TUI into Gizzi. We must port its **algorithm** to TypeScript.

---

## 1. Multica Absorption Plan

### 1.1 Renaming & Namespace Strategy

Multica is a **product brand**. We dissolve it into Allternit primitives. Every absorbed file gets an `@allternit/` prefix and lives in our namespace.

| Multica Concept | Allternit Native Name | Rationale |
|-----------------|----------------------|-----------|
| `multica` (product) | `allternit-cowork-team` | Distinguishes from existing solo Cowork |
| `multica-agent` | `cowork-agent` | Agent that participates in Cowork team |
| `multica-workspace` | `cowork-workspace` | Team-scoped isolation layer |
| `multica-board` | `cowork-board` | Issue/task board view |
| `multica-skill` | `cowork-skill` | Reusable team skill (extends existing skills) |
| `multica-runtime` | `cowork-runtime` | Runtime registration/discovery |
| `multica-daemon` | `gizzi-daemon` | Absorbed into gizzi-code daemon |

**Git Strategy:**
1. Fork `multica-ai/multica` to `allternitchitect/multica-fork` (private).
2. Create integration branch `absorb/multica-cowork-team` from `main`.
3. Do **not** merge Multica's Go backend. We read it, extract logic, rewrite in Rust/TS.
4. Delete Multica's frontend after porting components. No subtree merge — manual cherry-pick of components.

### 1.2 Surgical Integration Map

#### A. Platform UI — Next.js App Router (App Router, NOT Pages Router)

**New Routes:**

```
surfaces/allternit-platform/src/app/(platform)/cowork-team/
├── page.tsx                    → CoworkTeamDashboard (was: Multica board overview)
├── board/
│   └── page.tsx                → CoworkBoardView (was: Multica issue board)
├── agents/
│   └── page.tsx                → CoworkTeamAgentsView (was: Multica agents list)
├── workspaces/
│   └── page.tsx                → CoworkWorkspacesView (was: Multica workspaces)
├── workspaces/
│   └── [id]/
│       └── page.tsx            → CoworkWorkspaceDetailView
└── skills/
    └── page.tsx                → CoworkSkillsMarketplaceView (was: Multica skills)
```

**New API Routes:**

```
surfaces/allternit-platform/src/app/api/v1/cowork-team/
├── agents/
│   └── route.ts                → GET/POST/PUT/DELETE cowork-team agents
├── workspaces/
│   └── route.ts                → GET/POST workspaces
├── workspaces/
│   └── [id]/
│       ├── route.ts            → GET/PUT/DELETE workspace
│       ├── members/
│       │   └── route.ts        → GET/POST workspace members
│       └── invites/
│           └── route.ts        → POST invite member
├── board/
│   └── route.ts                → GET/POST board items (issues/tasks)
├── board/
│   └── [id]/
│       ├── route.ts            → GET/PUT/DELETE item
│       ├── assign/
│       │   └── route.ts        → POST assign to agent/human
│       └── comments/
│           └── route.ts        → GET/POST comments
├── skills/
│   └── route.ts                → GET/POST skills
├── skills/
│   └── [id]/
│       ├── route.ts            → GET/PUT/DELETE skill
│       └── install/
│           └── route.ts        → POST install skill to workspace
├── runtimes/
│   └── route.ts                → GET runtimes (from Multica daemon discovery)
└── stream/
    └── route.ts                → WebSocket/SSE for real-time board updates
```

**New Views (Components):**

```
surfaces/allternit-platform/src/views/cowork-team/
├── CoworkTeamDashboard.tsx     ← Multica dashboard overview
├── CoworkBoardView.tsx         ← Kanban board (issues, assignments, status)
├── CoworkBoardColumn.tsx       ← Board column component
├── CoworkBoardCard.tsx         ← Draggable card (issue/task)
├── CoworkTeamAgentsView.tsx    ← Agent profiles, status, runtimes
├── CoworkAgentProfileCard.tsx  ← Individual agent card
├── CoworkWorkspacesView.tsx    ← Workspace list
├── CoworkWorkspaceDetailView.tsx
├── CoworkSkillsMarketplaceView.tsx
├── CoworkSkillCard.tsx
├── CoworkRuntimePanel.tsx      ← Runtime status panel
└── index.ts
```

**New Stores:**

```
surfaces/allternit-platform/src/stores/cowork-team/
├── coworkTeam.store.ts         ← Zustand store: workspaces, board items, assignments
├── coworkTeamAgents.store.ts   ← Agent-as-teammate state
├── coworkTeamSkills.store.ts   ← Skills registry state
└── coworkTeamRuntimes.store.ts ← Runtime discovery state
```

**Integration with Existing Cowork:**

The existing `CoworkStore.ts` manages **solo agent sessions** (browser automation, observations, checkpoints). The new `coworkTeam.store.ts` manages **team coordination** (who is assigned what, board state, workspace isolation).

**Bridge file:**
```
surfaces/allternit-platform/src/lib/cowork-team/coworkTeamBridge.ts
```

This bridge:
- Converts a `cowork-team` board item into a `CoworkStore` task
- Routes agent-assigned items to the correct runtime
- Syncs completion status back to the board

#### B. Gizzi Code — Ink TUI Integration

Multica's CLI auto-discovery of agent CLIs (`claude`, `codex`, `openclaw`, etc.) gets absorbed into Gizzi.

```
cmd/gizzi-code/src/runtime/
├── runtime-discovery.ts        ← NEW: Auto-detect agent CLIs on PATH (from Multica daemon)
├── runtime-registry.ts         ← NEW: Registry of local runtimes
└── runtime-dashboard.ts        ← NEW: TUI dashboard of connected runtimes
```

New Gizzi commands:
```
cmd/gizzi-code/src/cli/commands/
├── runtime/
│   ├── list.ts                 ← gizzi runtime list
│   ├── register.ts             ← gizzi runtime register
│   └── status.ts               ← gizzi runtime status
```

New Gizzi screen:
```
cmd/gizzi-code/src/screens/RuntimeDashboard.tsx
```

#### C. Backend — Rust Services (We Do NOT Keep Multica's Go Backend)

Multica's Go backend (Chi, sqlc, gorilla/websocket) is **reference only**. We port concepts to existing Rust services.

**Target services to extend:**

| Multica Feature | Port To | Files to Create/Modify |
|-----------------|---------|----------------------|
| Workspace CRUD | `services/orchestration/orchestration/workspace-service/` | `src/workspace_team.rs` (new), extend `src/lib.rs` |
| Agent-as-teammate registry | `services/orchestration/orchestration/kernel-service/` | Extend `src/agent_registry.rs` with team fields |
| Issue/board taskgraph | `services/orchestration/orchestration/kernel-service/` | Extend `src/taskgraph.rs` with assignment nodes |
| Skills registry | `services/registry/server-registry/` | Add `skills` table, `src/skills.rs` |
| Runtime discovery | `services/orchestration/orchestration/kernel-service/` | `src/runtime_discovery.rs` (new) |
| WebSocket streaming | `cmd/allternit-api/` or `services/gateway/` | Add `/v1/cowork-team/stream` WS endpoint |

**Database Schema Additions (PostgreSQL, via existing Prisma or sqlx):**

```sql
-- Workspaces (tenant-like isolation)
CREATE TABLE cowork_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace Members
CREATE TABLE cowork_workspace_members (
  workspace_id UUID REFERENCES cowork_workspaces(id),
  user_id TEXT,
  agent_id TEXT,
  role TEXT CHECK (role IN ('owner', 'admin', 'member', 'agent')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (workspace_id, COALESCE(user_id, agent_id))
);

-- Board Items (issues/tasks)
CREATE TABLE cowork_board_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES cowork_workspaces(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked')),
  assignee_type TEXT CHECK (assignee_type IN ('human', 'agent')),
  assignee_id TEXT,
  reporter_id TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  labels TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
CREATE TABLE cowork_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES cowork_board_items(id),
  author_type TEXT CHECK (author_type IN ('human', 'agent')),
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Skills (extends existing plugin/skill concepts)
CREATE TABLE cowork_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES cowork_workspaces(id),
  name TEXT NOT NULL,
  description TEXT,
  manifest JSONB,          -- Plugin SDK manifest
  source_repo TEXT,
  version TEXT,
  installed_by TEXT,
  installed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Runtimes
CREATE TABLE cowork_runtimes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  agent_clis TEXT[],       -- ['claude', 'codex', 'openclaw', ...]
  status TEXT CHECK (status IN ('online', 'offline', 'busy')),
  last_heartbeat TIMESTAMPTZ,
  workspace_id UUID REFERENCES cowork_workspaces(id)
);
```

#### D. Plugin SDK — Skills as Plugins

Multica's "skills" map directly to Allternit's plugin system.

```
packages/@allternit/plugin-sdk/
├── src/
│   ├── cowork-skill/
│   │   ├── CoworkSkillManifest.ts    ← NEW: Skill-specific manifest extension
│   │   ├── CoworkSkillRuntime.ts     ← NEW: Runtime interface for skills
│   │   └── index.ts
│   └── ...
```

Skill marketplace UI in platform:
- Reuses existing `PluginMarketplace` component at `src/components/marketplace/PluginMarketplace`
- Add `CoworkSkillsMarketplaceView.tsx` as a filtered view of plugins tagged `type=cowork-skill`

### 1.3 Conflict Resolution

| Conflict | Resolution |
|----------|------------|
| **Multica Go vs Allternit Rust** | Go backend is read-only reference. Rewrite in Rust/TypeScript. No Go runtime dependencies added. |
| **Multica Next.js 16 vs Allternit Next.js 15** | Port components individually. Do not merge `package.json`. Use Allternit's existing dependency versions. |
| **Multica pgvector vs Allternit PostgreSQL** | Allternit already uses PostgreSQL. Add `pgvector` extension for semantic skill search only. |
| **"Agent" naming collision** | Multica's generic "agent" → `cowork-agent` or `team-agent`. Allternit's existing agent system (`src/lib/agents/`) remains `agent`. The bridge maps between them. |
| **"Workspace" naming collision** | Multica workspace (team container) → `cowork-workspace`. Allternit's existing workspace concepts (agent workspace files) remain `agent-workspace`. |
| **Task status enums** | Multica: `backlog/todo/in_progress/done/blocked`. Allternit CoworkStore: `pending/in_progress/completed/archived`. Bridge maps: `backlog/todo→pending`, `in_review→in_progress`, `done→completed`, `blocked→pending`. |
| **WebSocket endpoint collision** | Allternit already has streaming APIs. Multica's WS becomes `/v1/cowork-team/stream` — namespaced, not overlapping. |

---

## 2. Taskdog Absorption Plan

### 2.1 Renaming & Namespace Strategy

Taskdog is a Rust TUI. We keep the **algorithm**, discard the **TUI**.

| Taskdog Concept | Allternit Native Name | Notes |
|-----------------|----------------------|-------|
| `taskdog` (product) | `cowork-intelli-scheduler` | Internal module name, no user-facing brand |
| `taskdog` TUI | **Deleted** | Incompatible with Ink. Algorithm only. |
| Priority algorithm | `intelli-schedule` | Core scheduling engine |
| Task estimates | `task-estimate` | Duration/priority metadata on tasks |

**Git Strategy:**
1. Fork `Kohei-Wada/taskdog` to `allternitchitect/taskdog-fork` (private).
2. Read `src/` to understand algorithm (Rust).
3. Port algorithm to TypeScript. No merge of Rust code into Allternit.

### 2.2 Surgical Integration Map

#### A. Algorithm Port — TypeScript

**Source of truth:** Taskdog's Rust scheduling core (likely in `src/` of the fork).

**Destination:**

```
surfaces/allternit-platform/src/lib/cowork-team/
├── intelli-schedule/
│   ├── IntelliScheduleEngine.ts     ← Ported algorithm
│   ├── types.ts                     ← TaskEstimate, Priority, ScheduleSlot
│   ├── optimizers/
│   │   ├── deadlineOptimizer.ts     ← Deadline proximity weighting
│   │   ├── durationOptimizer.ts     ← Duration fitting
│   │   ├── priorityOptimizer.ts     ← Priority weighting
│   │   └── dependencyOptimizer.ts   ← Dependency chain ordering
│   └── index.ts
```

Also port to Gizzi:

```
cmd/gizzi-code/src/scheduler/
├── IntelliScheduleEngine.ts       ← Shared engine (same code, both locations)
└── types.ts                       ← Shared types
```

**Algorithm Specification (from Taskdog behavior):**

```typescript
interface IntelliScheduleInput {
  tasks: Array<{
    id: string;
    title: string;
    priority: number;        // 1-10
    estimatedMinutes: number;
    deadline?: Date;
    dependencies: string[];  // task IDs that must complete first
    tags?: string[];
  }>;
  constraints: {
    availableHoursPerDay: number;
    startTime: Date;
    bufferMinutes: number;
  };
}

interface IntelliScheduleOutput {
  orderedTasks: string[];    // Optimal execution order
  schedule: Array<{
    taskId: string;
    startTime: Date;
    endTime: Date;
    risk: 'low' | 'medium' | 'high';  // deadline collision risk
  }>;
  unrunnable: string[];      // Tasks that cannot fit
}
```

The engine scores each task:
```
score = (priority_weight * priority) 
      + (deadline_weight * (1 / hours_until_deadline))
      + (dependency_weight * dependency_depth)
      - (duration_penalty * estimatedMinutes)
```

Then runs a greedy bin-packing fit into available time slots.

#### B. Platform UI Integration

**Cowork Tasks View Enhancement:**

```
surfaces/allternit-platform/src/views/cowork/
├── TasksView.tsx                  ← MODIFY: Add "Optimize Schedule" button
├── IntelliSchedulePanel.tsx       ← NEW: Shows optimized order, risk badges
├── TaskEstimateModal.tsx          ← NEW: Set duration/priority/dependencies
└── ...
```

**CoworkStore Enhancement:**

```typescript
// surfaces/allternit-platform/src/views/cowork/CoworkStore.ts

interface Task {
  // ... existing fields ...
  estimatedMinutes?: number;   // NEW
  priority?: number;           // NEW (1-10)
  deadline?: string;           // NEW (ISO date)
  dependencies?: string[];     // NEW (task IDs)
}

interface CoworkState {
  // ... existing ...
  
  // Intelli-schedule
  optimizedOrder: string[] | null;
  scheduleRisk: Record<string, 'low' | 'medium' | 'high'>;
  
  // Actions
  optimizeSchedule: () => void;
  setTaskEstimate: (taskId: string, estimate: Partial<TaskEstimate>) => void;
  setTaskPriority: (taskId: string, priority: number) => void;
  setTaskDeadline: (taskId: string, deadline: string | null) => void;
  setTaskDependencies: (taskId: string, deps: string[]) => void;
}
```

#### C. Gizzi Code — Ink TUI Integration

Since Gizzi uses Ink, we add a **Taskdog-style intelligent task list** as an Ink screen.

```
cmd/gizzi-code/src/screens/
├── IntelliTaskScreen.tsx          ← NEW: Keyboard-optimized task list with scheduling
└── ...
```

This screen:
- Lists tasks in optimized order (not creation order)
- Shows `↑` `↓` priority indicators
- Shows `⏰` deadline risk (red/yellow/green)
- Shows `⏱` estimated duration
- Vim keybindings: `j/k` navigate, `Enter` start task, `o` optimize, `e` edit estimate

**Gizzi scheduler enhancement:**

```
cmd/gizzi-code/src/scheduler/
├── TaskScheduler.ts               ← MODIFY: Add optimize() call using IntelliScheduleEngine
└── IntelliScheduleEngine.ts       ← NEW: Ported algorithm
```

#### D. Rust Scheduler Enhancement (Optional Backend)

The existing Rust scheduler (`infrastructure/scheduler/`) handles cron expressions. We can optionally extend it with intelligent ordering for scheduled jobs.

```
infrastructure/scheduler/src/
├── intelli_schedule.rs            ← NEW: Rust port of algorithm (if we want backend optimization)
└── scheduler.rs                   ← MODIFY: Add intelligent reordering for pending jobs
```

**Decision:** Start with TypeScript-only (platform + Gizzi). Port to Rust only if we need server-side schedule optimization at scale.

### 2.3 Conflict Resolution

| Conflict | Resolution |
|----------|------------|
| **Rust TUI vs Ink TUI** | Taskdog Rust TUI is **not absorbed**. Algorithm is ported to TypeScript. |
| **Taskdog "task" vs Cowork "task"** | Taskdog tasks become "Cowork tasks with estimates". Same entity, enhanced schema. No new table. |
| **Vim keybindings in Gizzi** | Gizzi already has `src/vim/` and `src/keybindings/`. Taskdog's keybindings (`j/k/o/e`) align perfectly. No conflicts. |
| **Scheduling vs existing cron** | Cron is time-based triggers. Intelli-schedule is priority-based ordering. They compose: cron creates tasks, intelli-schedule orders them. |

---

## 3. DAG Task & Subtask Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ABSORPTION DAG                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 0: PREPARATION (1-2 days)                                            │
│  ├── [P0.1] Fork multica-ai/multica → allternitchitect/multica-fork       │
│  ├── [P0.2] Fork Kohei-Wada/taskdog → allternitchitect/taskdog-fork       │
│  ├── [P0.3] Audit existing Cowork/Agent/Skill stores for collision points │
│  └── [P0.4] Create integration branch: absorb/multica-taskdog-2026q2      │
│                                                                             │
│  PHASE 1: MULTICA BACKEND PORT (Week 1)                                     │
│  ├── [P1.1] Design cowork-team DB schema (workspaces, board, skills)      │
│  ├── [P1.2] Extend kernel-service: agent_registry.rs + team fields        │
│  ├── [P1.3] Extend kernel-service: taskgraph.rs + assignment nodes        │
│  ├── [P1.4] Create workspace-service: workspace CRUD + membership         │
│  ├── [P1.5] Extend server-registry: skills table + API                    │
│  ├── [P1.6] Add /v1/cowork-team/* API routes in allternit-api or gateway  │
│  └── [P1.7] Add WebSocket endpoint for real-time board streaming          │
│       ↑                                                                     │
│       └── P1.* all parallel after P0.4                                      │
│                                                                             │
│  PHASE 2: MULTICA PLATFORM UI (Week 1-2, starts after P1.1)               │
│  ├── [P2.1] Create cowork-team Zustand stores                             │
│  ├── [P2.2] Create app/(platform)/cowork-team/* route pages               │
│  ├── [P2.3] Create views/cowork-team/* components (Board, Agents, etc.)   │
│  ├── [P2.4] Create coworkTeamBridge.ts (solo ↔ team bridge)               │
│  ├── [P2.5] Integrate CoworkTeamDashboard into platform nav/dock          │
│  ├── [P2.6] Extend PluginMarketplace for cowork-skill type                │
│  └── [P2.7] Add cowork-team API route handlers in platform                │
│       ↑                                                                     │
│       └── P2.1 depends on P1.1 (schema). P2.4 depends on P2.2+P2.3.       │
│                                                                             │
│  PHASE 3: MULTICA GIZZI INTEGRATION (Week 2)                                │
│  ├── [P3.1] Port runtime auto-discovery from Multica daemon to Gizzi      │
│  ├── [P3.2] Add gizzi runtime list/register/status commands               │
│  ├── [P3.3] Create RuntimeDashboard.tsx Ink screen                        │
│  ├── [P3.4] Extend gizzi skills system with workspace-scoped skills       │
│  └── [P3.5] Add cowork-team CLI commands (gizzi cowork-team board, etc.)  │
│       ↑                                                                     │
│       └── P3.1 depends on understanding Multica daemon. P3.4 depends on   │
│           existing gizzi skills structure.                                  │
│                                                                             │
│  PHASE 4: TASKDOG ALGORITHM PORT (Week 2, parallel with P3)               │
│  ├── [P4.1] Read Taskdog Rust source, document algorithm                  │
│  ├── [P4.2] Port algorithm to TypeScript: IntelliScheduleEngine.ts        │
│  ├── [P4.3] Add optimizeSchedule() to CoworkStore                         │
│  ├── [P4.4] Create IntelliSchedulePanel.tsx in platform                   │
│  ├── [P4.5] Create TaskEstimateModal.tsx for setting estimates/priorities │
│  ├── [P4.6] Create IntelliTaskScreen.tsx Ink screen in Gizzi              │
│  └── [P4.7] Add optimize command to gizzi scheduler                       │
│       ↑                                                                     │
│       └── P4.2 depends on P4.1. P4.3-P4.7 depend on P4.2.                 │
│                                                                             │
│  PHASE 5: CONSOLIDATION & RENAME (Week 3)                                   │
│  ├── [P5.1] Rename all internal Multica references to cowork-team         │
│  ├── [P5.2] Rename all internal Taskdog references to intelli-schedule    │
│  ├── [P5.3] Update import paths, remove dead code                         │
│  ├── [P5.4] Write integration tests for board ↔ CoworkStore bridge        │
│  ├── [P5.5] Write integration tests for intelli-schedule engine           │
│  ├── [P5.6] Update platform navigation: add Cowork Team to main nav       │
│  └── [P5.7] Update AGENTS.md and docs with new cowork-team features       │
│       ↑                                                                     │
│       └── P5.* all parallel, depends on prior phases complete             │
│                                                                             │
│  PHASE 6: VALIDATION & SHIP (Week 3-4)                                      │
│  ├── [P6.1] Run full platform build (`pnpm build` in allternit-platform)  │
│  ├── [P6.2] Run Gizzi build (`bun run build` in gizzi-code)               │
│  ├── [P6.3] Run Rust workspace build (`cargo build --release`)            │
│  ├── [P6.4] Run existing test suites (platform, gizzi, rust)              │
│  ├── [P6.5] Manual QA: create workspace, assign agent, run task           │
│  ├── [P6.6] Manual QA: optimize schedule, verify ordering                 │
│  └── [P6.7] Merge integration branch to main                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Subtask Detail Table

| ID | Phase | Title | Owner | Depends On | Deliverable |
|----|-------|-------|-------|------------|-------------|
| P0.1 | Prep | Fork Multica repo | DevOps | — | `allternitchitect/multica-fork` |
| P0.2 | Prep | Fork Taskdog repo | DevOps | — | `allternitchitect/taskdog-fork` |
| P0.3 | Prep | Audit collision points | Backend Lead | — | Collision matrix doc |
| P0.4 | Prep | Create integration branch | DevOps | P0.1-P0.3 | `absorb/multica-taskdog-2026q2` |
| P1.1 | M-Back | DB schema design | Backend Lead | P0.4 | SQL migration files |
| P1.2 | M-Back | Extend agent_registry.rs | Rust Dev | P0.4 | PR with team fields |
| P1.3 | M-Back | Extend taskgraph.rs | Rust Dev | P0.4 | PR with assignment nodes |
| P1.4 | M-Back | Create workspace-service | Rust Dev | P1.1 | New service crate |
| P1.5 | M-Back | Extend server-registry skills | Rust Dev | P1.1 | PR with skills table |
| P1.6 | M-Back | Add cowork-team API routes | API Dev | P1.1-P1.5 | Route handlers |
| P1.7 | M-Back | Add WS streaming endpoint | API Dev | P1.6 | WebSocket handler |
| P2.1 | M-UI | Create Zustand stores | Frontend Lead | P1.1 | `src/stores/cowork-team/*.ts` |
| P2.2 | M-UI | Create route pages | Frontend Lead | P2.1 | `app/(platform)/cowork-team/*` |
| P2.3 | M-UI | Create view components | Frontend Lead | P2.1 | `views/cowork-team/*.tsx` |
| P2.4 | M-UI | Create bridge | Frontend Lead | P2.2+P2.3 | `coworkTeamBridge.ts` |
| P2.5 | M-UI | Integrate into nav/dock | Frontend Lead | P2.2 | Nav updates |
| P2.6 | M-UI | Extend PluginMarketplace | Frontend Lead | P2.3 | Skill marketplace filter |
| P2.7 | M-UI | Add API route handlers | Fullstack | P1.6 | Platform API routes |
| P3.1 | M-Gizzi | Port runtime discovery | Gizzi Lead | P0.4 | `runtime-discovery.ts` |
| P3.2 | M-Gizzi | Add runtime CLI commands | Gizzi Lead | P3.1 | `cli/commands/runtime/*` |
| P3.3 | M-Gizzi | RuntimeDashboard Ink screen | Gizzi Lead | P3.1 | `screens/RuntimeDashboard.tsx` |
| P3.4 | M-Gizzi | Extend skills system | Gizzi Lead | P0.4 | Workspace-scoped skills |
| P3.5 | M-Gizzi | Add cowork-team CLI | Gizzi Lead | P3.2+P3.4 | `gizzi cowork-team *` |
| P4.1 | T-Algo | Document Taskdog algorithm | Algo Dev | P0.2 | Algorithm spec doc |
| P4.2 | T-Algo | Port to TypeScript | Algo Dev | P4.1 | `IntelliScheduleEngine.ts` |
| P4.3 | T-Algo | Extend CoworkStore | Frontend Lead | P4.2 | Store enhancements |
| P4.4 | T-Algo | IntelliSchedulePanel | Frontend Lead | P4.2 | `IntelliSchedulePanel.tsx` |
| P4.5 | T-Algo | TaskEstimateModal | Frontend Lead | P4.2 | `TaskEstimateModal.tsx` |
| P4.6 | T-Algo | IntelliTaskScreen Ink | Gizzi Lead | P4.2 | `screens/IntelliTaskScreen.tsx` |
| P4.7 | T-Algo | Gizzi optimize command | Gizzi Lead | P4.2+P4.6 | Scheduler optimize hook |
| P5.1 | Consolidate | Rename Multica refs | All | P1-P4 | No `multica` strings remain |
| P5.2 | Consolidate | Rename Taskdog refs | All | P4 | No `taskdog` strings remain |
| P5.3 | Consolidate | Clean imports/dead code | All | P5.1+P5.2 | Lint pass |
| P5.4 | Consolidate | Bridge integration tests | QA | P2.4 | Test suite |
| P5.5 | Consolidate | Scheduler engine tests | QA | P4.2 | Test suite |
| P5.6 | Consolidate | Platform nav update | Frontend Lead | P2.5 | Nav with Cowork Team |
| P5.7 | Consolidate | Update AGENTS.md | Tech Writer | P5.6 | Docs PR |
| P6.1 | Validate | Platform build | CI | P5 | Clean build |
| P6.2 | Validate | Gizzi build | CI | P5 | Clean build |
| P6.3 | Validate | Rust build | CI | P5 | Clean build |
| P6.4 | Validate | Run test suites | CI | P6.1-P6.3 | All green |
| P6.5 | Validate | Manual QA: team flow | QA | P6.4 | QA signoff |
| P6.6 | Validate | Manual QA: schedule opt | QA | P6.4 | QA signoff |
| P6.7 | Validate | Merge to main | DevOps | P6.5+P6.6 | Main branch updated |

---

## 4. Exact File Creation/Modification List

### Files to Create (New)

```
surfaces/allternit-platform/
├── src/app/(platform)/cowork-team/page.tsx
├── src/app/(platform)/cowork-team/board/page.tsx
├── src/app/(platform)/cowork-team/agents/page.tsx
├── src/app/(platform)/cowork-team/workspaces/page.tsx
├── src/app/(platform)/cowork-team/workspaces/[id]/page.tsx
├── src/app/(platform)/cowork-team/skills/page.tsx
├── src/app/api/v1/cowork-team/agents/route.ts
├── src/app/api/v1/cowork-team/workspaces/route.ts
├── src/app/api/v1/cowork-team/workspaces/[id]/route.ts
├── src/app/api/v1/cowork-team/workspaces/[id]/members/route.ts
├── src/app/api/v1/cowork-team/workspaces/[id]/invites/route.ts
├── src/app/api/v1/cowork-team/board/route.ts
├── src/app/api/v1/cowork-team/board/[id]/route.ts
├── src/app/api/v1/cowork-team/board/[id]/assign/route.ts
├── src/app/api/v1/cowork-team/board/[id]/comments/route.ts
├── src/app/api/v1/cowork-team/skills/route.ts
├── src/app/api/v1/cowork-team/skills/[id]/route.ts
├── src/app/api/v1/cowork-team/skills/[id]/install/route.ts
├── src/app/api/v1/cowork-team/runtimes/route.ts
├── src/app/api/v1/cowork-team/stream/route.ts
├── src/views/cowork-team/CoworkTeamDashboard.tsx
├── src/views/cowork-team/CoworkBoardView.tsx
├── src/views/cowork-team/CoworkBoardColumn.tsx
├── src/views/cowork-team/CoworkBoardCard.tsx
├── src/views/cowork-team/CoworkTeamAgentsView.tsx
├── src/views/cowork-team/CoworkAgentProfileCard.tsx
├── src/views/cowork-team/CoworkWorkspacesView.tsx
├── src/views/cowork-team/CoworkWorkspaceDetailView.tsx
├── src/views/cowork-team/CoworkSkillsMarketplaceView.tsx
├── src/views/cowork-team/CoworkSkillCard.tsx
├── src/views/cowork-team/CoworkRuntimePanel.tsx
├── src/views/cowork-team/index.ts
├── src/views/cowork/IntelliSchedulePanel.tsx
├── src/views/cowork/TaskEstimateModal.tsx
├── src/stores/cowork-team/coworkTeam.store.ts
├── src/stores/cowork-team/coworkTeamAgents.store.ts
├── src/stores/cowork-team/coworkTeamSkills.store.ts
├── src/stores/cowork-team/coworkTeamRuntimes.store.ts
└── src/lib/cowork-team/coworkTeamBridge.ts

cmd/gizzi-code/
├── src/runtime/runtime-discovery.ts
├── src/runtime/runtime-registry.ts
├── src/runtime/runtime-dashboard.ts
├── src/cli/commands/runtime/list.ts
├── src/cli/commands/runtime/register.ts
├── src/cli/commands/runtime/status.ts
├── src/screens/RuntimeDashboard.tsx
├── src/scheduler/IntelliScheduleEngine.ts
└── src/screens/IntelliTaskScreen.tsx

services/orchestration/orchestration/workspace-service/
├── Cargo.toml
├── src/lib.rs
├── src/workspace_team.rs
└── src/membership.rs

services/orchestration/orchestration/kernel-service/src/
├── runtime_discovery.rs

services/registry/server-registry/src/
├── skills.rs

infrastructure/scheduler/src/
└── intelli_schedule.rs          (optional, Week 3+)
```

### Files to Modify (Existing)

```
surfaces/allternit-platform/
├── src/views/cowork/CoworkStore.ts              ← Add intelli-schedule fields + optimizeSchedule
├── src/views/cowork/TasksView.tsx               ← Add optimize button, estimate modal trigger
├── src/dock/TaskDock.tsx                        ← Add team task indicator
├── src/lib/agents/agent.store.ts                ← Add team-agent bridge fields
├── src/lib/agents/agent-cowork-integration.ts   ← Bridge to cowork-team board items
├── src/app/(platform)/layout.tsx                ← Add Cowork Team nav item
└── src/components/marketplace/PluginMarketplace.tsx ← Add cowork-skill filter

cmd/gizzi-code/
├── src/scheduler/TaskScheduler.ts               ← Add optimize() hook
├── src/skills/bundled/index.ts                  ← Add workspace skill loading
├── package.json                                 ← Add cowork-team bin if needed
└── src/cli/main.ts                              ← Register runtime commands

services/orchestration/orchestration/kernel-service/
├── src/agent_registry.rs                        ← Add team fields
├── src/taskgraph.rs                             ← Add assignment node type
├── src/lib.rs                                   ← Export new modules
└── Cargo.toml                                   ← Add workspace-service dependency

services/registry/server-registry/
├── src/lib.rs                                   ← Add skills module
├── src/main.rs                                  ← Add skills routes
└── migrations/                                  ← Add skills table migration

infrastructure/scheduler/
├── src/scheduler.rs                             ← Optional: intelli reorder
└── Cargo.toml                                   ← Optional: add intelli module
```

---

## 5. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Multica Go backend logic is complex to port | Medium | High | Read-only reference. Start with API contracts, implement in Rust incrementally. |
| Next.js version drift (Multica 16 vs Allternit 15) | Medium | Medium | Port components one-by-one. Do not merge package.json. Test each component. |
| Ink TUI limitations for board view | Medium | Medium | Gizzi gets simplified list view, not full Kanban. Full board stays in web platform. |
| DB migration conflicts with existing data | Low | High | Migrations are additive only. No renames of existing tables. |
| Agent store bloat | Medium | Medium | Keep `agent.store.ts` (solo) and `coworkTeamAgents.store.ts` (team) separate. Bridge between them. |
| Schedule algorithm performance | Low | Medium | Algorithm is O(n log n). Test with 1000+ tasks. Optimize if needed. |
| Team resists new nav structure | Low | Low | Make Cowork Team opt-in via feature flag until stable. |

---

## 6. Definition of Done

- [ ] No file contains the string `multica` (case-insensitive) except in attribution comments
- [ ] No file contains the string `taskdog` (case-insensitive) except in attribution comments
- [ ] Platform builds cleanly: `cd surfaces/allternit-platform && pnpm build`
- [ ] Gizzi builds cleanly: `cd cmd/gizzi-code && bun run build`
- [ ] Rust builds cleanly: `cargo build --release`
- [ ] All existing tests pass
- [ ] New integration tests pass: board ↔ CoworkStore bridge, intelli-schedule engine
- [ ] Manual QA: User can create workspace → add agent → assign board item → agent executes → status updates on board
- [ ] Manual QA: User can set task estimates → click optimize → tasks reorder intelligently
- [ ] `AGENTS.md` updated with new cowork-team features and file paths

---

*End of Plan — Ready for Review*
