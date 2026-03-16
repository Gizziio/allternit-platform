-- Create nodes table
CREATE TABLE IF NOT EXISTS nodes (
    node_id TEXT PRIMARY KEY,
    node_type TEXT NOT NULL,
    status TEXT NOT NULL,
    priority INTEGER NOT NULL,
    owner TEXT NOT NULL,
    source_refs TEXT NOT NULL,
    attributes TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
