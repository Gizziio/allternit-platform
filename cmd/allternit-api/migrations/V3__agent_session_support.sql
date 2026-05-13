-- Agent Session REST API support
-- Adds missing columns to agent_sessions and creates message/log tables.

-- ── Recreate agent_sessions with full schema ────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_sessions_new (
    id             TEXT PRIMARY KEY,
    name           TEXT,
    description    TEXT,
    agent_id       TEXT,
    agent_name     TEXT,
    runtime_model  TEXT,
    origin_surface TEXT DEFAULT 'chat',
    session_mode   TEXT DEFAULT 'regular',
    metadata       TEXT,
    active         INTEGER DEFAULT 1,
    tags           TEXT,
    user_id        TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO agent_sessions_new (
    id, name, agent_id, agent_name, runtime_model,
    origin_surface, session_mode, metadata, created_at, updated_at
)
SELECT
    id, name, agent_id, agent_name, runtime_model,
    origin_surface, session_mode, metadata, created_at, updated_at
FROM agent_sessions;

DROP TABLE agent_sessions;
ALTER TABLE agent_sessions_new RENAME TO agent_sessions;

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent ON agent_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_surface ON agent_sessions(origin_surface);

-- ── Agent session messages ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_session_messages (
    id         TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role       TEXT NOT NULL,
    content    TEXT NOT NULL,
    thinking   TEXT,
    metadata   TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_session_messages_session ON agent_session_messages(session_id);
