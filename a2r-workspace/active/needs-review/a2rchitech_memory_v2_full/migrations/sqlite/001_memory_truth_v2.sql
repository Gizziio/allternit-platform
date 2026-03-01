-- Memory v2: truth-preserving extensions to existing memory_entries
BEGIN TRANSACTION;

ALTER TABLE memory_entries ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE memory_entries ADD COLUMN valid_from INTEGER;
ALTER TABLE memory_entries ADD COLUMN valid_to INTEGER;
ALTER TABLE memory_entries ADD COLUMN confidence REAL DEFAULT 0.75;
ALTER TABLE memory_entries ADD COLUMN authority TEXT DEFAULT 'agent';
ALTER TABLE memory_entries ADD COLUMN supersedes_memory_id TEXT;

UPDATE memory_entries
SET valid_from = COALESCE(valid_from, created_at),
    status = COALESCE(status, 'active'),
    confidence = COALESCE(confidence, 0.75),
    authority = COALESCE(authority, 'agent')
WHERE valid_from IS NULL OR status IS NULL OR confidence IS NULL OR authority IS NULL;

CREATE INDEX IF NOT EXISTS idx_memory_status ON memory_entries(status);
CREATE INDEX IF NOT EXISTS idx_memory_valid_from ON memory_entries(valid_from);
CREATE INDEX IF NOT EXISTS idx_memory_valid_to ON memory_entries(valid_to);
CREATE INDEX IF NOT EXISTS idx_memory_supersedes ON memory_entries(supersedes_memory_id);

COMMIT;
