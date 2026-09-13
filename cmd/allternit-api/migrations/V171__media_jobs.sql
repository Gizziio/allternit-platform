-- Media generation plane (Phase 1 media plugins): provider job tracking and
-- downloaded artifact blobs. Provider keys come from the V134 BYOK credential
-- store (user_route_credentials) or the platform-funded env lane.

CREATE TABLE IF NOT EXISTS media_jobs (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    provider         TEXT NOT NULL,   -- minimax-h3 | fal-seedance
    model            TEXT NOT NULL,
    kind             TEXT NOT NULL,   -- video
    prompt           TEXT NOT NULL,
    params_json      TEXT,            -- original request params
    provider_task_id TEXT,            -- MiniMax task_id or fal request_id
    status           TEXT NOT NULL DEFAULT 'queued', -- queued|processing|succeeded|failed
    error            TEXT,
    artifact_id      TEXT,
    estimated_cost_usd REAL,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_media_jobs_user ON media_jobs(user_id, created_at);

CREATE TABLE IF NOT EXISTS media_artifacts (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    job_id       TEXT,
    content_type TEXT NOT NULL,
    bytes        BLOB NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_media_artifacts_user ON media_artifacts(user_id, created_at);
