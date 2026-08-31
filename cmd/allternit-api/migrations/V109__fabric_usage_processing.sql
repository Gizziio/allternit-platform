-- Usage event processing state: link each usage event to the cost event it
-- produced and record when it was converted into a ledger charge.

ALTER TABLE fabric_usage_events ADD COLUMN cost_event_id TEXT;
ALTER TABLE fabric_usage_events ADD COLUMN processed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_fabric_usage_events_processed
    ON fabric_usage_events(processed_at);
