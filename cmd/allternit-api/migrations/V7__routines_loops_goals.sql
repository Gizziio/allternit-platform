-- Goals, routines, and loops schema
-- Goals are high-level objectives. Routines are persistent scheduled jobs
-- (mirrored from gizzi cron jobs with scope=persistent). Loops are
-- session-scoped recurring jobs (mirrored from gizzi cron jobs with
-- scope=session). A goal can own many routines and loops.

CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT,
    agent_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    priority TEXT NOT NULL DEFAULT 'medium',
    target_date TEXT,
    progress INTEGER NOT NULL DEFAULT 0,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_workspace_id ON goals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_agent_id ON goals(agent_id);

CREATE TABLE IF NOT EXISTS routines (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT,
    agent_id TEXT,
    goal_id TEXT,
    gizzi_job_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    schedule_type TEXT NOT NULL,
    schedule_expression TEXT NOT NULL,
    timezone TEXT,
    config TEXT NOT NULL,
    tags TEXT,
    metadata TEXT,
    max_runs INTEGER,
    timeout_seconds INTEGER,
    max_retries INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_routines_user_id ON routines(user_id);
CREATE INDEX IF NOT EXISTS idx_routines_workspace_id ON routines(workspace_id);
CREATE INDEX IF NOT EXISTS idx_routines_status ON routines(status);
CREATE INDEX IF NOT EXISTS idx_routines_goal_id ON routines(goal_id);
CREATE INDEX IF NOT EXISTS idx_routines_agent_id ON routines(agent_id);

CREATE TABLE IF NOT EXISTS loops (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT,
    agent_id TEXT,
    goal_id TEXT,
    gizzi_job_id TEXT,
    session_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    schedule_type TEXT NOT NULL,
    schedule_expression TEXT NOT NULL,
    config TEXT NOT NULL,
    tags TEXT,
    metadata TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_loops_user_id ON loops(user_id);
CREATE INDEX IF NOT EXISTS idx_loops_workspace_id ON loops(workspace_id);
CREATE INDEX IF NOT EXISTS idx_loops_status ON loops(status);
CREATE INDEX IF NOT EXISTS idx_loops_goal_id ON loops(goal_id);
CREATE INDEX IF NOT EXISTS idx_loops_session_id ON loops(session_id);
CREATE INDEX IF NOT EXISTS idx_loops_agent_id ON loops(agent_id);

CREATE TABLE IF NOT EXISTS routine_runs (
    id TEXT PRIMARY KEY,
    routine_id TEXT NOT NULL,
    gizzi_run_id TEXT,
    status TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    duration_ms INTEGER,
    output TEXT,
    error TEXT,
    attempt INTEGER NOT NULL DEFAULT 1,
    triggered_by TEXT NOT NULL DEFAULT 'schedule',
    metadata TEXT,
    FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_routine_runs_routine_id ON routine_runs(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_runs_status ON routine_runs(status);
CREATE INDEX IF NOT EXISTS idx_routine_runs_scheduled_at ON routine_runs(scheduled_at);
