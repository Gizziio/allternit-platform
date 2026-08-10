CREATE TABLE IF NOT EXISTS prompt_leak_checks (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    user_text TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    threshold REAL NOT NULL,
    score REAL NOT NULL,
    flagged INTEGER NOT NULL,
    details TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompt_leak_checks_org_id
    ON prompt_leak_checks(org_id);
