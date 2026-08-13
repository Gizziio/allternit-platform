CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'assistants',
    bytes BLOB NOT NULL,
    size INTEGER NOT NULL,
    content_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
