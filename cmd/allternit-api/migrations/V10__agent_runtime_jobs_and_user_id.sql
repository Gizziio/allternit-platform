-- Agent runtime enhancements: ownership and per-runtime jobs.

-- Existing route handlers reference user_id but the baseline schema omitted it.
ALTER TABLE agent_runtimes ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_runtimes_user ON agent_runtimes(user_id);

-- Jobs submitted to an agent runtime.
CREATE TABLE IF NOT EXISTS agent_runtime_jobs (
    id          TEXT PRIMARY KEY,
    runtime_id  TEXT NOT NULL REFERENCES agent_runtimes(id) ON DELETE CASCADE,
    user_id     TEXT,
    status      TEXT NOT NULL DEFAULT 'queued',
    command     TEXT,
    args        TEXT,
    env         TEXT,
    working_dir TEXT,
    result      TEXT,
    exit_code   INTEGER,
    stdout      TEXT,
    stderr      TEXT,
    duration_ms INTEGER,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_runtime_jobs_runtime ON agent_runtime_jobs(runtime_id);
CREATE INDEX IF NOT EXISTS idx_runtime_jobs_status ON agent_runtime_jobs(status);
CREATE INDEX IF NOT EXISTS idx_runtime_jobs_user ON agent_runtime_jobs(user_id);
