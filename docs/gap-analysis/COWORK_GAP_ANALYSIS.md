# Cowork Gap Analysis & Implementation Roadmap

> Generated: 2026-04-18
> Scope: Allternit Platform + Gizzi CLI Cowork System
> Baseline: Multica + Taskdog Absorption (Completed)

---

## Executive Summary

The Multica+Taskdog absorption successfully **ported UI concepts, a scheduling algorithm, and CLI screens** into the Allternit codebase. However, the system remains a **client-side prototype** with no shared backend state, no real-time collaboration, and no agent execution loop. It is **not a production cowork system** and is **not comparable to Claude's `/cowork`**.

**What exists:** A visually rich task board, a CPM scheduler, demo TUI screens, and a run/jobs/approvals API.
**What's missing:** Task persistence, real-time sync, agent task workers, permission enforcement, and the conversational multi-agent loop that makes cowork "cowork."

---

## 1. Backend Gap Analysis

### 1.1 Task Management API — CRITICAL GAP ❌

| Feature | Status | Evidence |
|---------|--------|----------|
| `GET /api/v1/tasks` | ❌ Missing | Not in any router |
| `POST /api/v1/tasks` | ❌ Missing | Not in any router |
| `PUT /api/v1/tasks/:id` | ❌ Missing | Not in any router |
| `DELETE /api/v1/tasks/:id` | ❌ Missing | Not in any router |
| `POST /api/v1/tasks/:id/assign` | ❌ Missing | Not in any router |
| `POST /api/v1/tasks/:id/comment` | ❌ Missing | Not in any router |
| `POST /api/v1/tasks/:id/dependencies` | ❌ Missing | Not in any router |

**Database:** No `tasks`, `comments`, or `assignments` tables exist. The cowork schema has `runs`, `jobs`, `events`, `checkpoints`, `approval_requests`, `schedules`, `attachments` — but jobs are execution units, not collaborative task cards.

**Impact:** The platform's `CoworkStore`, `TasksView`, and `IntelliTaskScreen` are all client-side fiction. Two users see completely different boards.

---

### 1.2 Real-Time Collaboration — CRITICAL GAP ❌

| Feature | Status | Evidence |
|---------|--------|----------|
| Run event WebSocket | ✅ Exists | `api/cloud/allternit-cloud-api/src/websocket/run_ws.rs` |
| Generic pub/sub broker (Redis/NATS) | ❌ Missing | In-memory `tokio::sync::broadcast` only |
| Task-level live updates | ❌ Missing | No WS channel for task CRUD |
| Presence / "who's online" | ❌ Missing | No presence system |
| Live cursors / "X is editing" | ❌ Missing | Not implemented |
| Conflict resolution (OT/CRDT) | ❌ Missing | Last-write-wins only |

**Impact:** User A moves a task card → User B sees nothing until refresh. Concurrent edits = data loss.

---

### 1.3 Agent Execution Loop — CRITICAL GAP ❌

| Feature | Status | Evidence |
|---------|--------|----------|
| Cron job executor (local/docker/VM) | ✅ Exists | `cmd/gizzi-code/src/runtime/automation/cron/executors/cowork-executor.ts` |
| Agent polling a task queue | ❌ Missing | No task queue consumer |
| Agent claiming & executing tasks | ❌ Missing | No agent loop |
| Agent reporting results back to task | ❌ Missing | No result-to-task mapping |
| Handoff protocol between agents | ❌ Missing | Not implemented |
| Multi-agent conversation thread | ❌ Missing | Not implemented |

**Impact:** Tasks are static cards. No agent ever picks them up, executes them, or reports progress. The system is a board, not a workspace.

---

### 1.4 Permission & Tenant Isolation — MAJOR GAP ❌

| Feature | Status | Evidence |
|---------|--------|----------|
| Auth middleware (Bearer token) | ✅ Exists | `cmd/allternit-cloud-api/src/auth/middleware.rs` |
| Permission enums (`runs:read`, `jobs:write`, etc.) | ✅ Exists | `cmd/allternit-cloud-api/src/auth/permissions.rs` |
| `tenant_id` / `owner_id` fields in DB | ✅ Exists | `migrations/002_cowork_runtime.sql` |
| Tenant isolation enforced in routes | ❌ Missing | `list_runs` sets `tenant_id: None` |
| Workspace-level RBAC (admin/member/viewer) | ❌ Missing | Only flat permission strings on API tokens |
| Task-level permissions (who can edit) | ❌ Missing | Not implemented |

**Impact:** All tasks are globally visible (or client-only). No data boundaries between teams.

---

### 1.5 Notifications & Activity Feed — MAJOR GAP ❌

| Feature | Status | Evidence |
|---------|--------|----------|
| In-app notifications | ❌ Missing | Not implemented |
| Push notifications (web/email/Slack) | ❌ Missing | Not implemented |
| Activity feed / audit log | ❌ Missing | No `activity_logs` table for task events |
| @mentions in comments | ❌ Missing | No comment system at all |
| Deadline reminders | ❌ Missing | Not implemented |

---

## 2. Platform UI Gap Analysis

### 2.1 Data Persistence — CRITICAL GAP ❌

| Feature | Storage | Evidence |
|---------|---------|----------|
| Tasks & projects | **Client-only** (Zustand + localStorage) | `CoworkStore.ts` persist config |
| Task history / audit | **Client-only** | `CoworkStore.ts` partialize |
| Artifacts | **Client-only** | `ArtifactStore.ts` |
| Plugin install state | **Client-only** | `marketplace.ts` `INSTALLED_KEY` |
| Cron / scheduled jobs | **Real API** ✅ | `scheduled-jobs.service.ts` → `/api/agent-control` |

**Impact:** Reload the page = lose all tasks. This is the #1 blocker for "real cowork."

---

### 2.2 API Integration — MAJOR GAP ❌

| View | Endpoint Called | Error Handling | Backend Route Exists? |
|------|-----------------|----------------|----------------------|
| `TasksView` | `GET /api/v1/workspace/tasks` | Swallows errors | ❌ No |
| `RunsView` | `GET /api/v1/workspace/runs` | Swallows errors | ❌ No |
| `DocumentsView` | `GET /api/v1/workspace/documents` | Swallows errors | ❌ No |
| `ExportsView` | `GET /api/v1/workspace/exports` | Swallows errors | ❌ No |
| `TablesView` | `GET /api/v1/workspace/tables` | Swallows errors | ❌ No |
| `FilesView` | `GET /api/v1/workspace/files` | Swallows errors | ❌ No |

**Impact:** Every sub-view attempts to fetch from non-existent endpoints and silently fails, showing empty or stale localStorage data.

---

### 2.3 Plugin Marketplace — MINOR GAP ⚠️

| Feature | Status | Evidence |
|---------|--------|----------|
| Cowork category tab | ✅ Exists | `PluginMarketplace.tsx`, `BrowsePluginsOverlay.tsx` |
| Plugin browse / search | ✅ Exists | `marketplace.ts` |
| Plugin install | ⚠️ Stubbed | `console.log('Install', plugin.id)` |
| Plugin uninstall | ⚠️ Stubbed | `console.log('Uninstall', plugin.id)` |
| Plugin runtime loading | ⚠️ Aspirational | Dynamic import `/plugins/${id}/index.js` |

**Impact:** The UI looks complete but clicking "Install" does nothing except log to console.

---

### 2.4 SSE Event Stream — PARTIAL ⚠️

| Feature | Status | Evidence |
|---------|--------|----------|
| Client SSE hook | ✅ Exists | `cowork-client.ts` (`useCoworkStream`) |
| Backend SSE endpoint | ❌ Unverified | `/api/cowork/:sessionId/stream` not found in platform API routes |
| Integration into main chat | ❌ Missing | `CoworkRoot.tsx` uses `useRustStreamAdapter`, not `useCoworkStream` |

---

## 3. Gizzi CLI Gap Analysis

### 3.1 Task API Connection — CRITICAL GAP ❌

| Feature | Status | Evidence |
|---------|--------|----------|
| `gizzi cowork list` (runs) | ✅ Real API | `GET /api/v1/runs` |
| `gizzi cowork tasks` | ❌ Demo data | Tries `GET /api/v1/tasks`, falls back to 5 hardcoded tasks |
| `IntelliTaskScreen` data | ❌ Props-only | No internal API calls |

---

### 3.2 TUI Route Integration — MAJOR GAP ❌

| Feature | Status | Evidence |
|---------|--------|----------|
| `Cowork` route type defined | ✅ Exists | `cmd/gizzi-code/src/cli/ui/tui/routes/cowork.tsx` |
| `Cowork` route rendered in App | ❌ Missing | `app.tsx` Switch has no `Cowork` Match |
| Mode switcher routes to Cowork | ❌ Broken | `DiscretionaryScreen` navigates to `{ type: "cowork" }` → "Unhandled route" |

**Impact:** The only way to access cowork features in the TUI is via CLI commands (`gizzi cowork ...`), not through the interactive TUI navigation.

---

### 3.3 Shared State Between CLI and Platform — CRITICAL GAP ❌

| Feature | Status | Evidence |
|---------|--------|----------|
| Gizzi reads platform tasks | ❌ Missing | No API endpoint exists |
| Platform reads gizzi runs | ⚠️ Partial | `RunsView` calls `/api/v1/workspace/runs` (404) |
| Shared task state | ❌ Missing | Platform = localStorage, Gizzi = demo props |

---

## 4. Gap Priority Matrix

### P0 — Blockers (Must have for "real cowork")

| # | Gap | Effort | Owner |
|---|-----|--------|-------|
| 1 | **Task REST API + DB schema** (`tasks`, `comments`, `assignments` tables) | 3-4 days | Backend |
| 2 | **Platform UI → Task API integration** (replace localStorage with API calls) | 2-3 days | Platform |
| 3 | **Gizzi CLI → Task API integration** (fetch real tasks, remove demo fallback) | 1 day | Gizzi |
| 4 | **Tenant isolation enforcement** in all cowork routes | 1-2 days | Backend |

### P1 — Core Features (Needed for team collaboration)

| # | Gap | Effort | Owner |
|---|-----|--------|-------|
| 5 | **Real-time task updates** (WebSocket or SSE channel for task CRUD) | 3-4 days | Backend + Platform |
| 6 | **Presence system** (who's online, who's viewing a task) | 2-3 days | Backend + Platform |
| 7 | **Comments with @mentions** | 2 days | Backend + Platform |
| 8 | **Activity feed / audit log** | 2 days | Backend + Platform |
| 9 | **Agent task queue worker** (agent polls for tasks, executes, reports back) | 4-5 days | Backend + Agent |
| 10 | **Plugin install wiring** (replace `console.log` stubs with real API calls) | 1-2 days | Platform |

### P2 — Polish (Differentiates from basic board)

| # | Gap | Effort | Owner |
|---|-----|--------|-------|
| 11 | **Conflict resolution** (OT or CRDT for concurrent edits) | 3-5 days | Platform |
| 12 | **Notifications** (in-app, push, email, Slack) | 3-4 days | Backend + Platform |
| 13 | **Time tracking** (actual hours vs estimates) | 1-2 days | Backend + Platform |
| 14 | **Sprints / milestones** | 2-3 days | Backend + Platform |
| 15 | **File attachments on tasks** | 2 days | Backend + Platform |
| 16 | **TUI Cowork route wiring** (fix `app.tsx` to render Cowork route) | 1 day | Gizzi |
| 17 | **Multi-agent conversation thread** (Claude-style handoff) | 5-7 days | Backend + Platform + Agent |

---

## 5. Implementation Task List

### Phase 1: Backend Foundation (P0)

**Task 1.1 — Create `tasks` table migration**
```sql
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    tenant_id TEXT,
    owner_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'backlog', -- backlog, todo, in-progress, in-review, done
    priority INTEGER NOT NULL DEFAULT 50,
    estimated_minutes INTEGER,
    deadline TIMESTAMP,
    assignee_type TEXT, -- 'human' | 'agent'
    assignee_id TEXT,
    assignee_name TEXT,
    dependencies JSON, -- array of task IDs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Task 1.2 — Create `task_comments` table migration**
```sql
CREATE TABLE task_comments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Task 1.3 — Create `task_assignments` table migration (audit trail)**
```sql
CREATE TABLE task_assignments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    assignee_type TEXT NOT NULL,
    assignee_id TEXT NOT NULL,
    assignee_name TEXT,
    assigned_by TEXT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Task 1.4 — Implement Task REST API routes**
- `POST /api/v1/tasks` — create task
- `GET /api/v1/tasks` — list tasks (with workspace + tenant filter)
- `GET /api/v1/tasks/:id` — get task
- `PUT /api/v1/tasks/:id` — update task
- `DELETE /api/v1/tasks/:id` — delete task
- `POST /api/v1/tasks/:id/assign` — assign/unassign
- `GET /api/v1/tasks/:id/comments` — list comments
- `POST /api/v1/tasks/:id/comments` — add comment

**Task 1.5 — Enforce tenant isolation**
- Add middleware that injects `tenant_id` from auth token into all queries
- Reject queries where `tenant_id` doesn't match the authenticated user

**Task 1.6 — Enforce permissions**
- `runs:read` → can view tasks in runs they own
- `runs:write` → can create/update tasks
- `admin` → can view all tasks in tenant

### Phase 2: Platform UI Integration (P0-P1)

**Task 2.1 — Create `useTasksAPI` hook**
- Wraps `GET/POST/PUT/DELETE /api/v1/tasks`
- Uses React Query or SWR for caching and optimistic updates
- Replaces `CoworkStore`'s localStorage task CRUD

**Task 2.2 — Create `useCommentsAPI` hook**
- Wraps task comment endpoints
- Real-time comment list with polling or SSE

**Task 2.3 — Wire `TasksView` to real API**
- Remove `fetch('/api/v1/workspace/tasks')` (wrong endpoint)
- Use `useTasksAPI` instead
- Add loading states and error handling

**Task 2.4 — Wire `CoworkStore.optimizeSchedule` to backend**
- Option A: Run scheduler client-side (current), then sync results to API
- Option B: Move scheduler to backend, expose `POST /api/v1/tasks/optimize`

**Task 2.5 — Wire PluginMarketplace install actions**
- Replace `console.log` stubs with real `POST /api/v1/marketplace/install` calls
- Handle install progress and errors

### Phase 3: Real-Time Layer (P1)

**Task 3.1 — Create task-level SSE/WebSocket channel**
- Extend existing `run_ws.rs` or create new `task_ws.rs`
- Broadcast events: `task_created`, `task_updated`, `task_moved`, `comment_added`, `assignment_changed`

**Task 3.2 — Create platform `useTaskRealtime` hook**
- Connects to task WS/SSE
- Updates React Query cache on incoming events
- Shows toast notifications for remote changes

**Task 3.3 — Presence system**
- Heartbeat endpoint: `POST /api/v1/presence/heartbeat`
- Query endpoint: `GET /api/v1/presence/online` (returns user list)
- Show online indicators on task cards

### Phase 4: Agent Execution Loop (P1-P2)

**Task 4.1 — Create task queue table**
```sql
CREATE TABLE task_queue (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    agent_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, claimed, running, completed, failed
    claimed_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    result JSON,
    error TEXT
);
```

**Task 4.2 — Create agent worker loop**
- Agent polls `GET /api/v1/task-queue/claim` (atomic claim)
- Executes task (shell, docker, or VM via existing executor)
- Reports result via `POST /api/v1/task-queue/:id/complete`

**Task 4.3 — Wire `TasksView` to show agent execution status**
- Show "Agent running..." spinner on in-progress tasks
- Show agent result/output when complete
- Allow manual retry / takeover

### Phase 5: Gizzi CLI Integration (P0-P2)

**Task 5.1 — Wire `gizzi cowork tasks` to real API**
- Remove demo fallback
- Fetch from `GET /api/v1/tasks`
- Support workspace filter flag `--workspace=<id>`

**Task 5.2 — Add task CRUD to gizzi CLI**
- `gizzi cowork tasks create "<title>"`
- `gizzi cowork tasks edit <id> --estimate=<min>`
- `gizzi cowork tasks move <id> --status=<status>`
- `gizzi cowork tasks assign <id> --agent=<agent-id>`

**Task 5.3 — Wire TUI Cowork route**
- Add `<Match when={route.data.type === "cowork"}><Cowork /></Match>` to `app.tsx`
- Ensure `DiscretionaryScreen` → "Cowork Mode" actually navigates correctly

**Task 5.4 — Bidirectional sync**
- Gizzi task changes sync to platform via API
- Platform task changes sync to gizzi via SSE/WS

---

## 6. Effort Estimate Summary

| Phase | Scope | Effort | Parallelizable? |
|-------|-------|--------|-----------------|
| Phase 1: Backend Foundation | DB + REST API + auth | 5-7 days | ❌ (blocks everything) |
| Phase 2: Platform UI | Hooks + view wiring | 4-6 days | ✅ (with Phase 1) |
| Phase 3: Real-Time | WS/SSE + presence | 5-7 days | ❌ (needs Phase 1) |
| Phase 4: Agent Loop | Queue + worker + status | 6-8 days | ✅ (with Phase 1) |
| Phase 5: Gizzi CLI | API + TUI wiring | 3-4 days | ✅ (with Phase 1) |

**Total sequential effort:** ~20-25 days (1 engineer)
**Total with parallelism:** ~12-15 days (2-3 engineers)

---

## 7. Comparison to Claude's `/cowork`

| Feature | Claude `/cowork` | Allternit (Current) | Gap |
|---------|-----------------|---------------------|-----|
| Shared workspace | ✅ Real backend | ❌ localStorage | Phase 1 |
| Live multi-user | ✅ Real-time sync | ❌ No sync | Phase 3 |
| Agent execution | ✅ Agents pick up & run tasks | ❌ Static cards | Phase 4 |
| Conversational handoff | ✅ Agents chat in thread | ❌ No chat | Phase 4+5 |
| Human approval gates | ✅ Inline approval | ⚠️ UI exists, not wired | Phase 2 |
| Comments & mentions | ✅ Rich threading | ❌ No comments table | Phase 1+2 |
| Plugin marketplace | ✅ Install & run plugins | ⚠️ UI exists, stubs | Phase 2 |
| Mobile / responsive | ✅ Works everywhere | ⚠️ Desktop only | P3 |

---

## 8. Recommendation

**If you want "real cowork" in 2 weeks:**
1. Build Phase 1 (Backend Task API) — 1 engineer
2. Build Phase 2 (Platform UI wiring) — 1 engineer in parallel
3. Skip real-time (Phase 3) for now — use polling every 5s as MVP

**If you want Claude-level cowork:**
- Add Phase 4 (Agent Loop) and Phase 3 (Real-Time)
- Budget 4-6 weeks with 2-3 engineers

**If you want to ship NOW:**
- The current implementation is a **polished demo**. It looks real but has no shared state.
- It can be used for solo task management or screenshots, not team collaboration.
