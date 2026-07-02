-- ── Cowork jobs (DAG nodes) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cowork_jobs (
    id              TEXT PRIMARY KEY,
    run_id          TEXT NOT NULL,
    dag_node_id     TEXT NOT NULL,
    job_type        TEXT NOT NULL,
    priority        INTEGER NOT NULL DEFAULT 0,
    state           TEXT NOT NULL,
    lease_owner     TEXT,
    retry_count     INTEGER NOT NULL DEFAULT 0,
    max_retries     INTEGER NOT NULL DEFAULT 0,
    timeout_sec     INTEGER NOT NULL DEFAULT 0,
    payload         TEXT NOT NULL DEFAULT '{}',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at      DATETIME,
    completed_at    DATETIME
);

CREATE INDEX IF NOT EXISTS idx_cowork_jobs_run ON cowork_jobs(run_id);
CREATE INDEX IF NOT EXISTS idx_cowork_jobs_state ON cowork_jobs(state);

-- ── Cowork handoffs (agent/task handoff records) ──────────────────────────────
CREATE TABLE IF NOT EXISTS cowork_handoffs (
    id              TEXT PRIMARY KEY,
    run_id          TEXT NOT NULL,
    from_agent_id   TEXT,
    to_agent_id     TEXT NOT NULL,
    task_id         TEXT,
    note            TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at    DATETIME
);

CREATE INDEX IF NOT EXISTS idx_cowork_handoffs_run ON cowork_handoffs(run_id);
CREATE INDEX IF NOT EXISTS idx_cowork_handoffs_status ON cowork_handoffs(status);
