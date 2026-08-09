-- Memory Stores scaffold: named, user-scoped memory stores with a
-- redaction policy applied before content is persisted or surfaced.
CREATE TABLE IF NOT EXISTS beta_memory_stores (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    name TEXT NOT NULL,
    redaction_policy TEXT NOT NULL DEFAULT '{}',
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_beta_memory_stores_user_created
    ON beta_memory_stores(user_id, created_at DESC);
