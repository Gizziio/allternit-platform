-- Session-scoped file store for agent files.
CREATE TABLE IF NOT EXISTS session_files (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    org_id TEXT,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES beta_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_files_session
    ON session_files(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_files_org
    ON session_files(org_id);
