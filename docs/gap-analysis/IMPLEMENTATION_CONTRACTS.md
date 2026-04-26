# Cowork Implementation Contracts

> Contracts between Backend, Platform UI, and Gizzi CLI
> All patterns must match existing codebase conventions

---

## 1. Database Schema (SQLite — matches existing `002_cowork_runtime.sql`)

### `tasks` table
```sql
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    tenant_id TEXT,
    owner_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'backlog', -- backlog | todo | in-progress | in-review | done
    priority INTEGER NOT NULL DEFAULT 50,
    estimated_minutes INTEGER,
    deadline TIMESTAMP,
    assignee_type TEXT, -- 'human' | 'agent'
    assignee_id TEXT,
    assignee_name TEXT,
    assignee_avatar TEXT,
    dependencies JSON, -- array of task IDs
    optimize_rank INTEGER,
    risk TEXT, -- 'low' | 'medium' | 'high'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_type, assignee_id);
```

### `task_comments` table
```sql
CREATE TABLE task_comments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author TEXT NOT NULL,
    author_avatar TEXT,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comments_task ON task_comments(task_id);
```

### `task_assignments` table (audit trail)
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

CREATE INDEX idx_assignments_task ON task_assignments(task_id);
```

### `task_queue` table (agent worker queue — inspired by SuperAGI)
```sql
CREATE TABLE task_queue (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    agent_id TEXT,
    agent_role TEXT, -- 'developer' | 'browser' | 'document' | 'reviewer'
    status TEXT NOT NULL DEFAULT 'pending', -- pending | claimed | running | completed | failed | cancelled
    claimed_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    result JSON,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_queue_status ON task_queue(status);
CREATE INDEX idx_queue_agent ON task_queue(agent_id);
CREATE INDEX idx_queue_task ON task_queue(task_id);
```

### `task_events` table (audit trail — append-only, inspired by existing `events` table)
```sql
CREATE TABLE task_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- created | updated | moved | assigned | commented | completed
    payload JSON,
    source_client TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_events_task ON task_events(task_id);
CREATE INDEX idx_task_events_type ON task_events(event_type);
```

---

## 2. REST API Contract (Rust Axum — matches existing routes in `cmd/allternit-cloud-api/src/routes/`)

### Base path: `/api/v1/tasks`

| Method | Path | Auth Required | Description |
|--------|------|--------------|-------------|
| POST | `/api/v1/tasks` | ✅ | Create task |
| GET | `/api/v1/tasks` | ✅ | List tasks (workspace + tenant filtered) |
| GET | `/api/v1/tasks/:id` | ✅ | Get task by ID |
| PUT | `/api/v1/tasks/:id` | ✅ | Update task |
| DELETE | `/api/v1/tasks/:id` | ✅ | Delete task |
| POST | `/api/v1/tasks/:id/assign` | ✅ | Assign/unassign task |
| GET | `/api/v1/tasks/:id/comments` | ✅ | List comments |
| POST | `/api/v1/tasks/:id/comments` | ✅ | Add comment |
| POST | `/api/v1/tasks/optimize` | ✅ | Run IntelliSchedule, return optimized order |
| GET | `/api/v1/tasks/stream` | ✅ (SSE) | Real-time task events stream |

### Query params for `GET /api/v1/tasks`
- `workspace_id` (required)
- `status` (optional, comma-separated)
- `assignee_id` (optional)
- `priority_min` / `priority_max` (optional)
- `limit` / `offset` (optional, default 50/0)

### Request/Response DTOs (match existing `RunResponse` pattern)
```rust
pub struct TaskResponse {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: i32,
    pub estimated_minutes: Option<i32>,
    pub deadline: Option<String>, // ISO 8601
    pub assignee_type: Option<String>,
    pub assignee_id: Option<String>,
    pub assignee_name: Option<String>,
    pub assignee_avatar: Option<String>,
    pub dependencies: Vec<String>,
    pub optimize_rank: Option<i32>,
    pub risk: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

pub struct CommentResponse {
    pub id: String,
    pub task_id: String,
    pub author: String,
    pub author_avatar: Option<String>,
    pub body: String,
    pub created_at: String,
}
```

---

## 3. Platform UI Contract (React hooks — matches existing patterns)

### `useTasksAPI` hook
```typescript
// Returns React Query-style interface
const { tasks, isLoading, error, createTask, updateTask, deleteTask, assignTask, addComment } = useTasksAPI(workspaceId);

// All mutations invalidate the tasks query cache
// Optimistic updates for UI responsiveness
```

### `useTaskRealtime` hook
```typescript
// Connects to SSE endpoint
const { isConnected, lastEvent } = useTaskRealtime(workspaceId);

// On incoming event, updates React Query cache
// Shows toast for remote changes by other users
```

### Store changes
- `CoworkStore` keeps local state as **cache**, not source of truth
- On mount: hydrate from API
- On mutation: optimistically update local state, then sync to API
- On SSE event: merge remote change into local state

---

## 4. Gizzi CLI Contract

### API calls
```typescript
// Fetch real tasks from backend
const tasks = await apiCall<TaskItem[]>("GET", `/api/v1/tasks?workspace_id=${workspaceId}`);

// No more demo fallback
```

### New subcommands
- `gizzi cowork tasks create "<title>" --workspace=<id>`
- `gizzi cowork tasks edit <id> --estimate=<min> --priority=<n>`
- `gizzi cowork tasks move <id> --status=<status>`
- `gizzi cowork tasks assign <id> --agent=<agent-id>`
- `gizzi cowork tasks comment <id> "<body>"`

---

## 5. Tenant Isolation Rules

Every task query MUST include:
```rust
WHERE tenant_id = ? AND workspace_id = ?
```

The `tenant_id` is extracted from the auth token and injected by middleware.

No route handler should ever accept `tenant_id` from query params.
