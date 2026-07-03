-- Create registry_items table
CREATE TABLE IF NOT EXISTS registry_items (
    id TEXT PRIMARY KEY,
    item_type TEXT NOT NULL,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    description TEXT,
    tags TEXT NOT NULL DEFAULT '[]', -- JSON array of tags
    content_hash TEXT NOT NULL,
    metadata TEXT NOT NULL, -- JSON metadata
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    publisher_id TEXT NOT NULL,
    channels TEXT NOT NULL DEFAULT '[]', -- JSON array of channels
    downloads INTEGER DEFAULT 0,
    rating REAL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_registry_items_type ON registry_items(item_type);
CREATE INDEX IF NOT EXISTS idx_registry_items_name ON registry_items(name);
CREATE INDEX IF NOT EXISTS idx_registry_items_publisher ON registry_items(publisher_id);
CREATE INDEX IF NOT EXISTS idx_registry_items_created_at ON registry_items(created_at);
CREATE INDEX IF NOT EXISTS idx_registry_items_content_hash ON registry_items(content_hash);

-- Create full-text search table for descriptions and names
CREATE VIRTUAL TABLE IF NOT EXISTS registry_items_fts USING fts5(
    name, description, tags, content='registry_items'
);

-- Trigger to keep FTS index up to date
CREATE TRIGGER IF NOT EXISTS registry_items_ai AFTER INSERT ON registry_items
BEGIN
    INSERT INTO registry_items_fts(rowid, name, description, tags) 
    VALUES (new.rowid, new.name, new.description, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS registry_items_au AFTER UPDATE ON registry_items
BEGIN
    DELETE FROM registry_items_fts WHERE rowid = old.rowid;
    INSERT INTO registry_items_fts(rowid, name, description, tags) 
    VALUES (new.rowid, new.name, new.description, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS registry_items_ad AFTER DELETE ON registry_items
BEGIN
    DELETE FROM registry_items_fts WHERE rowid = old.rowid;
END;
