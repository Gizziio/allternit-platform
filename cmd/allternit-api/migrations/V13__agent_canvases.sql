-- Agent session canvases
-- Stores persistent canvas artifacts linked to agent sessions.
-- Frontend surfaces (chat, code, cowork, design, browser) can create,
-- update, and retrieve canvases for a session without re-parsing messages.

CREATE TABLE IF NOT EXISTS agent_canvases (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT,
    title TEXT,
    components TEXT NOT NULL DEFAULT '[]',
    layout TEXT,
    metadata TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_canvases_session_id ON agent_canvases(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_canvases_user_id ON agent_canvases(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_canvases_updated_at ON agent_canvases(updated_at);
