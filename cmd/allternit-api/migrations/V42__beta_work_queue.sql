-- External worker poll protocol: tasks leased by self-hosted sandbox workers.
-- A task carries a sandbox image + env payload and is optionally tied to a
-- managed session or a scheduled deployment.
CREATE TABLE IF NOT EXISTS beta_work_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT,
    deployment_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'leased', 'running', 'succeeded', 'failed', 'cancelled')),
    payload TEXT NOT NULL DEFAULT '{}',
    sandbox_image TEXT,
    env TEXT NOT NULL DEFAULT '{}',
    lease_worker_id TEXT,
    lease_expires_at DATETIME,
    result TEXT,
    error TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES beta_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (deployment_id) REFERENCES beta_deployments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_beta_work_tasks_user_created
    ON beta_work_tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_work_tasks_status_created
    ON beta_work_tasks(status, created_at);
