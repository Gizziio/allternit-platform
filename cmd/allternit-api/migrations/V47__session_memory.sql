CREATE TABLE IF NOT EXISTS session_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    memory_key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, session_id, memory_key)
);

CREATE INDEX IF NOT EXISTS session_memory_user_session_idx
    ON session_memory(user_id, session_id);
CREATE INDEX IF NOT EXISTS session_memory_key_idx
    ON session_memory(memory_key);
