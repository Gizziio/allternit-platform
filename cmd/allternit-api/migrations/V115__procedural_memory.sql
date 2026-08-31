-- Site-specific procedural memory: reusable successful agent paths.

CREATE TABLE IF NOT EXISTS procedural_memory (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    agent_id         TEXT,
    name             TEXT NOT NULL,
    description      TEXT,
    trigger_patterns TEXT NOT NULL, -- JSON array of strings (domains, URLs, keywords)
    steps            TEXT NOT NULL, -- JSON array of step objects
    success_count    INTEGER NOT NULL DEFAULT 1,
    last_used_at     DATETIME,
    source_session_id TEXT,
    verified         INTEGER NOT NULL DEFAULT 0,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_procedural_memory_user_agent
    ON procedural_memory(user_id, agent_id);

CREATE INDEX IF NOT EXISTS idx_procedural_memory_user_name
    ON procedural_memory(user_id, name);

CREATE INDEX IF NOT EXISTS idx_procedural_memory_trigger
    ON procedural_memory(user_id, trigger_patterns);
