-- Cowork Tasks tables for Allternit Control Plane
-- Provides task management, comments, assignments, agent queue, and event audit trail

-- ============================================================================
-- Tasks table
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    tenant_id TEXT,
    owner_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'todo', 'in-progress', 'in-review', 'done')),
    priority INTEGER NOT NULL DEFAULT 50,
    estimated_minutes INTEGER,
    deadline TIMESTAMP,
    assignee_type TEXT CHECK (assignee_type IN ('human', 'agent')),
    assignee_id TEXT,
    assignee_name TEXT,
    assignee_avatar TEXT,
    dependencies JSON,
    optimize_rank INTEGER,
    risk TEXT CHECK (risk IN ('low', 'medium', 'high')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Task comments table
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_comments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author TEXT NOT NULL,
    author_avatar TEXT,
    body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Task assignments table (audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_assignments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    assignee_type TEXT NOT NULL CHECK (assignee_type IN ('human', 'agent')),
    assignee_id TEXT NOT NULL,
    assignee_name TEXT,
    assigned_by TEXT,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Task queue table (agent worker queue)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_queue (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    agent_id TEXT,
    agent_role TEXT CHECK (agent_role IN ('developer', 'browser', 'document', 'reviewer')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'running', 'completed', 'failed', 'cancelled')),
    claimed_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    result JSON,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Task events table (audit trail -- append-only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'moved', 'assigned', 'commented', 'completed')),
    payload JSON,
    source_client TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_type, assignee_id);

CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id);

CREATE INDEX IF NOT EXISTS idx_assignments_task ON task_assignments(task_id);

CREATE INDEX IF NOT EXISTS idx_queue_status ON task_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_agent ON task_queue(agent_id);
CREATE INDEX IF NOT EXISTS idx_queue_task ON task_queue(task_id);

CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_type ON task_events(event_type);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================
CREATE TRIGGER IF NOT EXISTS update_tasks_timestamp
AFTER UPDATE ON tasks
BEGIN
    UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
