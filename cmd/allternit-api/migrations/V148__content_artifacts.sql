-- A:// Artifacts API Phase 1 (docs/design/artifacts-api.md §2): content
-- artifacts — renderable HTML-first objects with append-only immutable
-- versions. Adjacent to the document-artifact tables (artifacts /
-- artifact_sections / artifact_revisions), which are untouched; no existing
-- rows are migrated.

CREATE TABLE IF NOT EXISTS content_artifacts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    project_id TEXT,
    source_session_id TEXT,
    prompt TEXT,
    design_system_id TEXT,
    skill_id TEXT,
    skill_name TEXT,
    sandbox_policy TEXT NOT NULL DEFAULT 'standard',
    thumbnail TEXT,
    current_version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    deleted_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_content_artifacts_user_created
    ON content_artifacts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_content_artifacts_type
    ON content_artifacts(type);
CREATE INDEX IF NOT EXISTS idx_content_artifacts_project
    ON content_artifacts(project_id);

-- One row per immutable version. Versions are append-only: editing an
-- artifact inserts the next version and bumps current_version on the
-- artifact row; a version row is never rewritten.
CREATE TABLE IF NOT EXISTS content_artifact_versions (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    body TEXT NOT NULL,
    body_sha256 TEXT NOT NULL,
    storage TEXT NOT NULL DEFAULT 'inline',
    file_path TEXT,
    created_at DATETIME NOT NULL,
    UNIQUE(artifact_id, version),
    FOREIGN KEY (artifact_id) REFERENCES content_artifacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_content_artifact_versions_artifact
    ON content_artifact_versions(artifact_id, version);

-- Idempotency keys for create/append, keyed on (user_id, key) with a 24h TTL
-- swept lazily on write. `version` is set for append responses so a retried
-- append replays the original version number instead of double-appending.
CREATE TABLE IF NOT EXISTS content_artifact_idempotency (
    key TEXT NOT NULL,
    user_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL,
    version INTEGER,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, key)
);
