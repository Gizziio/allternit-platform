-- Scheduled deployments: recurring agent runs on a cron schedule, with a
-- history of individual triggered runs.
CREATE TABLE IF NOT EXISTS beta_deployments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT,
    cron TEXT NOT NULL,
    next_run_at DATETIME,
    last_run_at DATETIME,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_beta_deployments_user_created
    ON beta_deployments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_deployments_status_next_run
    ON beta_deployments(status, next_run_at);

CREATE TABLE IF NOT EXISTS beta_deployment_runs (
    id TEXT PRIMARY KEY,
    deployment_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
    result TEXT,
    error TEXT,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME,
    FOREIGN KEY (deployment_id) REFERENCES beta_deployments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_beta_deployment_runs_deployment
    ON beta_deployment_runs(deployment_id, started_at DESC);
