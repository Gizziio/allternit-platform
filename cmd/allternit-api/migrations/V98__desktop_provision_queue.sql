CREATE TABLE IF NOT EXISTS desktop_provision_queue (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    org_id       TEXT,
    bot_id       TEXT NOT NULL,
    os           TEXT,
    template_id  TEXT,
    status       TEXT NOT NULL DEFAULT 'pending',
    sandbox_id   TEXT,
    provider     TEXT,
    host         TEXT,
    error        TEXT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dpq_user ON desktop_provision_queue(user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_dpq_bot ON desktop_provision_queue(bot_id, status);
CREATE INDEX IF NOT EXISTS idx_dpq_pending ON desktop_provision_queue(status, created_at) WHERE status = 'pending';
