-- A:// Artifacts API — per-artifact file tree (docs/design/artifacts-api.md
-- §7 Phase 2 multi-file sync, 2026-09-12). Design-mode projects are a flat
-- per-project tree of files (HTML/CSS/JSON/MD); until now only /index.html
-- synced to the gateway (as the artifact version body). This table mirrors
-- the whole tree per artifact so any browser can read-through-fill its local
-- IndexedDB cache. Upsert-keyed on (artifact_id, path); bodies inline.

CREATE TABLE IF NOT EXISTS content_artifact_files (
    artifact_id TEXT NOT NULL,
    path TEXT NOT NULL,
    body TEXT NOT NULL,
    body_sha256 TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (artifact_id, path),
    FOREIGN KEY (artifact_id) REFERENCES content_artifacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_content_artifact_files_artifact
    ON content_artifact_files(artifact_id);
