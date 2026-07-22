-- Ephemeral (incognito) chat sessions: created with `ephemeral: true` (or
-- `metadata.ephemeral`), these are excluded from session list responses,
-- skipped by memory consolidation, and purged on abort. Gizzi's runtime
-- schema has no such flag, so the API tracks it locally — same pattern as
-- session_origin_surface (V11).
CREATE TABLE IF NOT EXISTS ephemeral_sessions (
    session_id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
