-- Skills / task recipes: reusable parameterized agent run templates.

CREATE TABLE IF NOT EXISTS skills (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    organization_id TEXT,
    name            TEXT NOT NULL,
    description     TEXT,
    goal_template   TEXT NOT NULL,
    parameters      TEXT NOT NULL DEFAULT '{}',
    allowed_sites   TEXT,
    run_count       INTEGER NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_skills_user
    ON skills(user_id, updated_at DESC);
