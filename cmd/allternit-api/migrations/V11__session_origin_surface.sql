-- Preserve the original frontend surface value when Gizzi's runtime schema does
-- not yet accept it (e.g. "design"). The API normalizes to a supported Gizzi
-- surface for storage and restores the original value in metadata responses.
CREATE TABLE IF NOT EXISTS session_origin_surface (
    session_id TEXT PRIMARY KEY,
    origin_surface TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session_origin_surface_origin
    ON session_origin_surface(origin_surface);
