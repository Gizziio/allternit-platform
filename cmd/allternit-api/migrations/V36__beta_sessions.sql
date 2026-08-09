-- Managed agent session lifecycle, threads, event stream, and budgets.
CREATE TABLE IF NOT EXISTS beta_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT,
    name TEXT,
    parent_thread_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    metadata TEXT NOT NULL DEFAULT '{}',
    max_tokens INTEGER,
    max_turns INTEGER,
    max_tool_calls INTEGER,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    turns_used INTEGER NOT NULL DEFAULT 0,
    tool_calls_used INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at DATETIME,
    FOREIGN KEY (parent_thread_id) REFERENCES beta_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_beta_sessions_user_created
    ON beta_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_sessions_parent
    ON beta_sessions(parent_thread_id);

CREATE TABLE IF NOT EXISTS beta_session_events (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES beta_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_beta_session_events_stream
    ON beta_session_events(session_id, sequence);
