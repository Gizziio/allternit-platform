-- Add canonical AllternitOS Placement fields so Cloud can store and return
-- the canonical type directly instead of maintaining a parallel view struct.
ALTER TABLE fabric_placements ADD COLUMN node_id TEXT;
ALTER TABLE fabric_placements ADD COLUMN ipv4 TEXT;
ALTER TABLE fabric_placements ADD COLUMN endpoint TEXT;
ALTER TABLE fabric_placements ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE fabric_placements ADD COLUMN labels_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE fabric_placements ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE fabric_placements ADD COLUMN updated_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_fabric_placements_node_id
    ON fabric_placements(node_id);
