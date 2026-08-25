CREATE TABLE IF NOT EXISTS desktop_quotas (
    user_id             TEXT PRIMARY KEY,
    org_id              TEXT,
    max_concurrent      INTEGER,
    max_monthly_minutes INTEGER,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS desktop_usage (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL,
    org_id      TEXT,
    bot_id      TEXT NOT NULL,
    sandbox_id  TEXT NOT NULL,
    provider    TEXT,
    started_at  DATETIME NOT NULL,
    ended_at    DATETIME,
    minutes     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_desktop_usage_user ON desktop_usage(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_desktop_usage_org ON desktop_usage(org_id, started_at);
CREATE INDEX IF NOT EXISTS idx_desktop_usage_active ON desktop_usage(user_id, ended_at) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_desktop_usage_bot ON desktop_usage(bot_id);
