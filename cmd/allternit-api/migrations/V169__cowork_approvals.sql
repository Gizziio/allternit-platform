-- ── Cowork approval gate queue ────────────────────────────────────────────────
-- Persists pending ApprovalGate decisions for the cowork permission surface.
-- `list_approvals` scopes reads with `(user_id = ? OR user_id IS NULL)`, so
-- user_id stays nullable: NULL rows are global approvals visible to everyone.
CREATE TABLE IF NOT EXISTS cowork_approvals (
    id        TEXT PRIMARY KEY,
    user_id   TEXT,
    content   TEXT NOT NULL,
    source    TEXT NOT NULL DEFAULT 'system',
    dismissed INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cowork_approvals_user ON cowork_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_cowork_approvals_dismissed ON cowork_approvals(dismissed);
