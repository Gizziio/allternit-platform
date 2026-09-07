-- Long-running autonomous tasks that survive sidepanel/process restarts.

CREATE TABLE IF NOT EXISTS long_running_tasks (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    organization_id TEXT,
    title           TEXT NOT NULL,
    goal            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','paused','completed','failed','cancelled')),
    progress        INTEGER NOT NULL DEFAULT 0,
    result          TEXT,
    error           TEXT,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_long_running_tasks_user
    ON long_running_tasks(user_id, updated_at DESC);
