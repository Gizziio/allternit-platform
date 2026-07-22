-- V28: per-project file attachments for Cowork projects (metadata rows only —
-- the blobs live behind /api/v1/uploads or external URLs).
CREATE TABLE IF NOT EXISTS cowork_project_files (
    id         TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    name       TEXT NOT NULL,
    url        TEXT,
    upload_id  TEXT,
    media_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cowork_project_files_project ON cowork_project_files(project_id);
