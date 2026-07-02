-- Migration V4: Add task comments, task assignee type/name, and cowork queue tables

CREATE TABLE IF NOT EXISTS task_comments (
    id          TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL,
    body        TEXT NOT NULL,
    author_id   TEXT NOT NULL,
    author_name TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);

-- Add assignee_type and assignee_name to tasks table
-- Note: sqlite ALTER TABLE is safe when run exactly once via refinery migrations
ALTER TABLE tasks ADD COLUMN assignee_type TEXT;
ALTER TABLE tasks ADD COLUMN assignee_name TEXT;

-- Add cowork_queue table
CREATE TABLE IF NOT EXISTS cowork_queue (
    id           TEXT PRIMARY KEY,
    task_id      TEXT NOT NULL,
    agent_id     TEXT,
    agent_role   TEXT,
    status       TEXT NOT NULL DEFAULT 'pending',
    claimed_at   DATETIME,
    started_at   DATETIME,
    completed_at DATETIME,
    result       TEXT,
    error        TEXT,
    retry_count  INTEGER DEFAULT 0,
    max_retries  INTEGER DEFAULT 3,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cowork_queue_status ON cowork_queue(status);
