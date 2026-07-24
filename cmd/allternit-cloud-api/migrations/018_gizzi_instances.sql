-- Self-registered gizzi instances (`gizzi serve --tunnel`). A user runs gizzi
-- on their own machine behind an ephemeral public URL and registers it with
-- their Clerk session so first-party apps can discover it. Unlike
-- runtime_devices these records carry no credentials or relay lifecycle.

CREATE TABLE IF NOT EXISTS gizzi_instances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_gizzi_instances_user ON gizzi_instances(user_id);

CREATE TRIGGER IF NOT EXISTS update_gizzi_instances_timestamp
AFTER UPDATE ON gizzi_instances
BEGIN
    UPDATE gizzi_instances SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
