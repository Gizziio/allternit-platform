CREATE TABLE computer_groups (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK(owner_type IN ('user','org')),
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_type, owner_id, name)
);
ALTER TABLE computers ADD COLUMN group_id TEXT REFERENCES computer_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_computer_groups_owner ON computer_groups(owner_type, owner_id);
