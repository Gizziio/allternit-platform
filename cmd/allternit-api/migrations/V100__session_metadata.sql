-- Store frontend session metadata for sessions whose backing Gizzi record
-- does not preserve the full metadata bag (session mode, bot flags, etc.).
CREATE TABLE IF NOT EXISTS session_metadata (
    session_id TEXT PRIMARY KEY NOT NULL,
    metadata TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_session_metadata_session_id ON session_metadata(session_id);
