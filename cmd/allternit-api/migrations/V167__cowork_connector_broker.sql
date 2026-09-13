-- ── Connector broker v0.1 (A:// §8.5; task A-T5) ────────────────────────────
-- Invariant: principals never receive raw long-lived connector secrets.
-- The broker validates (principal, run, capability, policy), issues a
-- short-lived session, and the SYSTEM performs the external call. Secrets
-- are referenced by env var NAME — the value is never stored in the DB.
CREATE TABLE IF NOT EXISTS cowork_connector_secrets (
    capability  TEXT PRIMARY KEY,
    secret_env  TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cowork_connector_sessions (
    id          TEXT PRIMARY KEY,
    principal   TEXT NOT NULL,
    run_id      TEXT NOT NULL,
    job_id      TEXT NOT NULL,
    capability  TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active',
    expires_at  DATETIME NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cowork_connector_sessions_job ON cowork_connector_sessions(job_id);

-- Reference connector (task A-T5): system-side webhook delivery.
INSERT OR IGNORE INTO cowork_connector_secrets (capability, secret_env)
VALUES ('connector.webhook.send', 'ALLTERNIT_BROKER_WEBHOOK_URL');
