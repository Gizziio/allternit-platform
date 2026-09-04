-- Align fabric_usage_events with the canonical AllternitOS usage-event.schema.json
-- so Cloud can use allternitos_cloud_contracts::UsageEvent directly instead of a
-- parallel view struct.
ALTER TABLE fabric_usage_events ADD COLUMN node_id TEXT;
ALTER TABLE fabric_usage_events ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE fabric_usage_events ADD COLUMN labels_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE fabric_usage_events ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_fabric_usage_events_node
    ON fabric_usage_events(node_id);
