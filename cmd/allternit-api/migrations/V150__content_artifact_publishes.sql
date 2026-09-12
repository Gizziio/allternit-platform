-- A:// Artifacts API Phase 3 (docs/design/artifacts-api.md §6 publish tier):
-- hosted publish state for the shared Cloudflare Pages project.
--
-- A publish snapshots an immutable version (decision 2): the row records
-- `published_version` and later version appends do NOT change what is live.
-- Deployments stay immutable (decision 3): unpublish sets `unpublished_at`
-- and removes the route only; the deployment itself is never deleted.

CREATE TABLE IF NOT EXISTS content_artifact_publishes (
    artifact_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    published_version INTEGER NOT NULL,
    route_path TEXT NOT NULL,
    deployment_id TEXT,
    deployment_url TEXT,
    publisher_kind TEXT NOT NULL DEFAULT 'fs',
    published_at DATETIME NOT NULL,
    unpublished_at DATETIME,
    FOREIGN KEY (artifact_id) REFERENCES content_artifacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_content_artifact_publishes_user
    ON content_artifact_publishes(user_id, published_at);

-- Per-user route prefix in the shared Pages project (decision 1), stored
-- idempotently (INSERT OR IGNORE). The prefix is derived deterministically
-- from the user id, so re-derivation always converges on the same row.
CREATE TABLE IF NOT EXISTS content_artifact_publish_routes (
    user_id TEXT PRIMARY KEY,
    route_prefix TEXT NOT NULL,
    created_at DATETIME NOT NULL
);
