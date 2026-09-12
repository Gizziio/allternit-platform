-- ── Cowork approval bindings (A:// §8.14) ────────────────────────────────────
-- An approval is bound to an execution context: executor, capability, target,
-- run, job, and lease generation. When a lease generation expires, its bound
-- approvals are invalidated; a replacement worker under a new generation must
-- re-obtain approval for the protected action.
CREATE TABLE IF NOT EXISTS cowork_approval_bindings (
    id               TEXT PRIMARY KEY,
    run_id           TEXT NOT NULL,
    job_id           TEXT NOT NULL,
    lease_id         TEXT NOT NULL,
    lease_generation INTEGER NOT NULL,
    executor         TEXT NOT NULL,
    capability       TEXT NOT NULL,
    target           TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'pending',
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    decided_at       DATETIME,
    decided_by       TEXT
);

CREATE INDEX IF NOT EXISTS idx_cowork_approval_bindings_job ON cowork_approval_bindings(job_id);
CREATE INDEX IF NOT EXISTS idx_cowork_approval_bindings_run ON cowork_approval_bindings(run_id);
