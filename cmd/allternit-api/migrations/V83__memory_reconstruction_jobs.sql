-- Memory reconstruction jobs: rebuild or enrich long-term memory from
-- session events, memory stores, or other sources.
CREATE TABLE IF NOT EXISTS memory_reconstruction_jobs (
    id              TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    source_type     TEXT NOT NULL, -- session | memory_store | file
    source_id       TEXT NOT NULL,
    config          TEXT NOT NULL DEFAULT '{}', -- JSON object
    status          TEXT NOT NULL DEFAULT 'pending', -- pending | running | completed | failed
    result          TEXT DEFAULT '{}', -- JSON object
    created_by      TEXT NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memory_reconstruction_jobs_org
    ON memory_reconstruction_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_memory_reconstruction_jobs_source
    ON memory_reconstruction_jobs(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_memory_reconstruction_jobs_status
    ON memory_reconstruction_jobs(status);
