-- ── Cowork runs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cowork_runs (
    id                     TEXT PRIMARY KEY,
    tenant_id              TEXT NOT NULL,
    workspace_id           TEXT NOT NULL,
    initiator              TEXT NOT NULL,
    mode                   TEXT NOT NULL,
    state                  TEXT NOT NULL,
    entrypoint             TEXT NOT NULL,
    dag_id                 TEXT NOT NULL,
    current_job_id         TEXT,
    current_checkpoint_id   TEXT,
    policy_profile         TEXT NOT NULL,
    created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at           DATETIME
);

CREATE INDEX IF NOT EXISTS idx_cowork_runs_workspace ON cowork_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cowork_runs_state ON cowork_runs(state);

-- ── Cowork run events ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cowork_run_events (
    id          TEXT PRIMARY KEY,
    run_id      TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    payload     TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cowork_run_events_run ON cowork_run_events(run_id);
