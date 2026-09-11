-- Memory store contents: namespaced key/value entries inside a
-- beta_memory_store. Sessions bind stores via metadata.memory_store_ids and
-- workers receive the contents as a capped memory_context payload field.
CREATE TABLE IF NOT EXISTS beta_memory_entries (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    namespace TEXT NOT NULL DEFAULT 'default',
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, namespace, key),
    FOREIGN KEY (store_id) REFERENCES beta_memory_stores(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_beta_memory_entries_store
    ON beta_memory_entries(store_id, namespace, key);
