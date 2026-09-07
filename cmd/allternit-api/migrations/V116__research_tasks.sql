-- Ultrabrowse deep-research execution mode: track long-running research tasks.

CREATE TABLE IF NOT EXISTS research_tasks (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    agent_id        TEXT,
    query           TEXT NOT NULL,
    mode            TEXT NOT NULL DEFAULT 'ultrabrowse', -- ultrabrowse | standard
    status          TEXT NOT NULL DEFAULT 'pending', -- pending | running | completed | failed
    sources         TEXT, -- JSON array of {url, title, summary}
    synthesis       TEXT, -- Markdown or plain-text synthesis
    max_depth       INTEGER NOT NULL DEFAULT 3,
    max_sources     INTEGER NOT NULL DEFAULT 10,
    metadata        TEXT, -- JSON
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_research_tasks_user_status
    ON research_tasks(user_id, status);

CREATE INDEX IF NOT EXISTS idx_research_tasks_user_created
    ON research_tasks(user_id, created_at DESC);
